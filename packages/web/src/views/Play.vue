<template lang="pug">
main.container
  section
    .container(ref="player")
    b-menu
      b-menu-list(label="Playlist")
        .playlist
          b-menu-item(v-for="f, i in playlist" :key="f.key" :label="f.name" @click="doPlay(i)" :active="currentTrack === i")
    b-menu
      b-menu-list(label="Upload new files")
      b-field(style="text-align: center;")
        b-upload(v-model="dropFiles" drag-drop multiple accept="audio")
          section.section
            .content.has-text-centered
              p
                b-icon(icon="file-upload" size="is-large")
              p Drop your files here or click to upload
  b-modal(:active.sync="!!uploading.length")
    .card(v-for="u in uploading" :key="u.key")
      .card-header
        .card-header-title {{u.name}}
      .card-content
        b-progress(:value="u.progress" :type="u.type" show-value format="percent")
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import firebase from 'firebase/app'
import WaveSurfer from 'wavesurfer.js'
import shortid from 'shortid'

import 'firebase/storage'
import 'firebase/firebase-firestore'

@Component
export default class Play extends Vue {
  playlist: any[] = []
  currentTrack = 0

  dropFiles: File[] = []
  uploading: any[] = []

  wavesurfer: WaveSurfer | null = null

  async created () {
    const allRefs = await firebase.firestore().collection('metadata')
      .orderBy('_rand').limit(10).get()

    allRefs.forEach((r) => {
      const data = r.data()
      data._rand = Math.random()

      this.playlist.unshift({
        key: r.id,
        name: data.name,
        url: data.url
      })

      firebase.firestore().collection('metadata').doc(r.id).set(data)
    })
  }

  mounted () {
    const w = this.wavesurfer = WaveSurfer.create({
      container: this.$refs.player as HTMLElement
    })
    w.on('ready', () => {
      w.play()
    })
    w.on('finish', () => {
      this.currentTrack++
      this.doPlay()
    })
  }

  @Watch('dropFiles')
  async onAddFiles () {
    const storageRef = firebase.storage().ref()

    await Promise.all(this.dropFiles.map(async (f) => {
      const randName = f.name.replace(/\..+$/, '') + '-' + shortid.generate()
      const uploadTask = storageRef.child(`audio/${randName}`).put(f)

      const u = {
        key: randName,
        name: f.name
      }
      this.uploading.unshift(u)

      return new Promise((resolve, reject) => {
        uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          this.$set(u, 'progress', progress)
          this.$set(u, 'type', '')

          switch (snapshot.state) {
            case firebase.storage.TaskState.PAUSED: // or 'paused'
              this.$set(u, 'type', 'is-warning')
              break
            case firebase.storage.TaskState.RUNNING: // or 'running'
              this.$set(u, 'type', 'is-info')
              break
          }
        }, (error: any) => {
          this.$buefy.snackbar.open(JSON.stringify(error))

          switch (error.code) {
            case 'storage/unauthorized':
            // User doesn't have permission to access the object
              break

            case 'storage/canceled':
            // User canceled the upload
              break

            case 'storage/unknown':
            // Unknown error occurred, inspect error.serverResponse
              break
          }
          reject(error)
        }, () => {
          this.uploading = this.uploading.filter((u) => u.key !== randName)

          uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
            this.currentTrack = 0

            this.playlist.unshift({
              key: randName,
              name: f.name,
              url: downloadURL
            })

            firebase.firestore().collection('metadata').doc(randName).set({
              name: f.name,
              url: downloadURL,
              _rand: Math.random(),
              _upload: true,
              type: 'audio'
            })

            resolve()
          }).catch(reject)
        })
      })
    }))
  }

  doPlay (i?: number) {
    this.currentTrack = i = i || this.currentTrack

    if (this.wavesurfer && this.playlist[i]) {
      this.wavesurfer.load(this.playlist[i].url)
    }
  }
}
</script>

<style lang="scss" scoped>
main {
  margin-top: 1em;

  > section {
    width: 100%;
  }

  .playlist {
    max-height: 50vh;
    overflow: scroll;
    background-color: #eee;
  }

  @media screen and (min-width: 800px) {
    .playlist {
      max-height: 300px;
      overflow: scroll;
    }
  }
}
</style>
