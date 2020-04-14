<template lang="pug">
.container.editor
  .buttons.header-buttons
    div(style="flex-grow: 1;")
    b-button.is-info(@click="ctxReload()") Reload
    b-button.is-warning(@click="hasPreview = !hasPreview") {{hasPreview ? 'Hide' : 'Show'}} Preview
    b-button.is-success(:disabled="!isEdited" @click="save") Save
  .columns
    .column(
      style="height: calc(100vh - 60px); overflow-y: scroll;"
      :class="hasPreview ? 'is-6-desktop is-hidden-mobile' : 'is-12'"
      @scroll="onScroll"
    )
      b-collapse(class="card" animation="slide" aria-id="requiredHeader" style="margin-bottom: 1em;")
        div(
          slot="trigger" slot-scope="props" class="card-header" role="button" aria-controls="requiredHeader"
        )
          h1.card-header-title(style="font-family: monospace;") {{name}}
          a.card-header-icon
            b-icon(:icon="props.open ? 'caret-up' : 'caret-down'")
        .card-content
          b-field(label="Name" label-position="on-border")
            b-input(v-model="name")
          b-field(label="Tag" label-position="on-border")
            b-taginput(
              v-model="tag" ellipsis icon="tag" placeholder="Add a tag"
              allow-new open-on-focus :data="filteredTags" @focus="initFilteredTags" @typing="getFilteredTags"
            )
      codemirror(v-model="markdown" ref="codemirror" @input="onCmCodeChange")
    .column.is-6(
      v-show="hasPreview"
      style="height: calc(100vh - 60px); overflow-y: scroll;"
      ref="preview"
    )
      div(style="width: 100%; padding: 1em; margin-bottom: 50px;")
        audio(v-if="audioUrl" :src="audioUrl" controls autoplay loop style="width: 100%; margin-bottom: 1em;")
        .content(ref="output")
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import dayjs from 'dayjs'
import CodeMirror from 'codemirror'
import axios, { AxiosInstance } from 'axios'
import firebase from 'firebase/app'
import hbs from 'handlebars'
import * as t from 'runtypes'

import 'firebase/storage'
import 'firebase/firebase-firestore'

import { normalizeArray, nullifyObject, stringSorter, deepMerge } from '../assets/utils'
import { Matter } from '../assets/make-html/matter'
import MakeHtml from '../assets/make-html'

@Component<Edit>({
  beforeRouteLeave (to, from, next) {
    const msg = this.canSave ? 'Please save before leaving.' : null

    if (msg) {
      this.$buefy.dialog.confirm({
        message: msg,
        confirmText: 'Leave',
        cancelText: 'Cancel',
        onConfirm: () => next(),
        onCancel: () => next(false)
      })
    } else {
      next()
    }
  }
})
export default class Edit extends Vue {
  hasPreview = false
  isEdited = false
  markdown = ''

  tag: string[] = []
  filteredTags: string[] = []
  allTags: string[] | null = null

  name = ''

  ctx = {} as any
  isMobile = matchMedia('(max-width: 800px)').matches

  readonly matter = new Matter()

  get id () {
    return normalizeArray(this.$route.query.id) || ''
  }

  get audioUrl () {
    const { type, url, autoplay } = this.matter.header

    return (type === 'audio' && url && autoplay !== false)
      ? url
      : ''
  }

  get makeHtml () {
    return new MakeHtml(this.id)
  }

  get codemirror (): CodeMirror.Editor {
    return (this.$refs.codemirror as any).codemirror
  }

  get canSave () {
    return this.name && this.isEdited
  }

  created () {
    this.hasPreview = !this.isMobile
    this.load()
  }

  mounted () {
    this.isEdited = false
    this.codemirror.setSize('100%', '100%')
    this.codemirror.addKeyMap({
      'Cmd-S': () => { this.save() },
      'Ctrl-S': () => { this.save() }
    })

    // @ts-ignore
    this.codemirror.on('paste', async (ins, evt) => {
      const { items } = evt.clipboardData || {} as any
      if (items) {
        for (const k of Object.keys(items)) {
          const item = items[k]
          if (item.kind === 'file') {
            evt.preventDefault()
            const f: File = item.getAsFile()

            const cursor = ins.getCursor()
            let filename = f.name

            if (filename === 'image.png') {
              filename = dayjs().format('YYYYMMDD-HHmmss') + '.png'
            }

            const snapshot = await firebase.storage().ref().child(`image/${filename}`).put(f)
            ins.getDoc().replaceRange(`![${filename}](${snapshot.downloadURL})`, cursor)
          }
        }
      }
    })

    window.onbeforeunload = (e: any) => {
      const msg = this.canSave ? 'Please save before leaving.' : null
      if (msg) {
        e.returnValue = msg
        return msg
      }
    }
  }

  beforeDestroy () {
    window.onbeforeunload = null
  }

  formatDate (d: Date) {
    return dayjs(d).format('YYYY-MM-DD HH:mm Z')
  }

  async initFilteredTags () {
    if (!this.allTags) {
      const doc = await firebase.firestore().collection('tag').doc('all').get()
      this.allTags = (doc.data() || {}).tags || []
    }
    this.allTags = stringSorter(Array.from(new Set([...this.allTags!, ...this.tag])))
  }

  async getFilteredTags (text?: string) {
    if (this.allTags) {
      this.filteredTags = text ? this.allTags
        .filter((t) => {
          return t && !this.tag.includes(t) && t.toLocaleLowerCase().includes(text.toLocaleLowerCase())
        }) : this.allTags
    }
  }

  @Watch('id')
  async load () {
    let isSet = false

    if (this.id) {
      const r = await firebase.firestore().collection('metadata').doc(this.id).get()
      const data = r.data()

      if (data) {
        const {
          tag,
          name,
          markdown,
          ...h0
        } = data

        let { header, content } = this.matter.parse(markdown || '')
        this.ctx[this.id] = data

        header = nullifyObject(deepMerge(Object.entries(h0)
          .filter(([k]) => k[0] !== '_')
          .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {}), header))

        await this.onCtxChange(header.ref || {})

        this.markdown = this.matter.stringify(content, header)
        this.name = name

        this.$set(this, 'tag', tag)
        isSet = true
      }
    }

    if (!isSet) {
      this.matter.header = {}
      this.markdown = ''
      this.name = ''
      this.$set(this, 'tag', [])
    }

    const title = document.getElementsByTagName('title')[0]
    const t = title.getAttribute('data-title') || ''
    title.innerText = this.name ? `${this.name} - ${t}` : t

    setTimeout(() => {
      this.isEdited = false
    }, 100)
  }

  async save () {
    if (!this.canSave) {
      return
    }

    const { header, content: markdown } = this.matter.parse(this.markdown)
    let id = header.id
    delete header.id

    const content = nullifyObject({
      markdown,
      name: this.name,
      tag: this.tag,
      _rand: Math.random(),
      _updatedAt: new Date(),
      ...header
    })

    if (!this.id) {
      /**
       * Create a post
       */
      if (id) {
        await firebase.firestore().collection('metadata').doc(id).set(content)
      } else {
        const doc = await firebase.firestore().collection('metadata').add(content)
        id = doc.id
      }

      this.$router.push({
        query: {
          id
        }
      })
    } else {
      await firebase.firestore().collection('metadata').doc(this.id).update(content)
    }

    await firebase.firestore().collection('tag').doc('all').set({
      tags: this.allTags
    })

    this.$buefy.snackbar.open('Saved')

    setTimeout(() => {
      this.isEdited = false
    }, 100)
  }

  onCmCodeChange () {
    this.isEdited = true
    const outputRef = this.$refs.output as HTMLDivElement

    if (outputRef) {
      const { header, content } = this.matter.parse(this.markdown)
      this.makeHtml.patch(outputRef, hbs.compile(content)({
        ...(this.name ? {
          [this.name]: content
        } : {}),
        ...this.ctx
      }))
    }
  }

  @Watch('name')
  @Watch('tag', { deep: true })
  onHeaderChange () {
    this.isEdited = true
  }

  async ctxReload () {
    const { header, content } = new Matter().parse(this.markdown)
    if (this.name) {
      this.ctx[this.name] = content
    }

    await this.onCtxChange(header.ref)
  }

  async onCtxChange (ctx: any) {
    if (!ctx || typeof ctx !== 'object') {
      return
    }

    if (Array.isArray(ctx)) {
      ctx = ctx.reduce((prev, c) => ({ ...prev, [c]: null }), {})
    }

    await Promise.all(Object.entries<any>(ctx).map(async ([key, data]) => {
      if (typeof data !== 'undefined' && !this.ctx[key]) {
        if (!data) {
          const r = await firebase.firestore().collection('metadata').doc(key).get()
          const data = r.data()

          if (data) {
            const { header, content } = new Matter().parse(data.markdown || '')
            this.ctx[key] = header
            this.ctx[key].markdown = content
          }
        } else {
          if (typeof data === 'string') {
            this.ctx[key] = (await axios.get(data)).data
          } else if (data.url) {
            this.ctx[key] = (await axios(data)).data
          }
        }
      }
    }))
  }

  onScroll (evt: any) {
    const preview = this.$refs.preview as HTMLDivElement
    if (preview) {
      const scrollSize = evt.target.scrollTop / (evt.target.scrollHeight - evt.target.clientHeight)
      preview.scrollTop = scrollSize * (preview.scrollHeight - preview.clientHeight)
    }
  }
}
</script>

<style lang="scss">
.header-buttons {
  white-space: nowrap;
  display: flex;
  padding-left: 1em;
  padding-right: 1em;
  padding-bottom: 5px;
  margin-bottom: 1em !important;
  align-self: center;
  justify-content: flex-end;
  box-shadow: 0 1px #ccc;

  > .button {
    margin-bottom: 0 !important;
  }
}

.CodeMirror-scroll {
  min-height: calc(100vh - 200px);
}

.CodeMirror-lines {
  margin-bottom: 50px;
}

.d-none {
  display: none;
}

.editor {
  margin-top: 1em;
}

@media screen and (max-width: 800px) {
  .editor {
    margin-top: unset;
  }
}
</style>
