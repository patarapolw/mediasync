<template lang="pug">
#App
  b-navbar(shadow)
    template(slot="brand")
      b-navbar-item(tag="router-link" to="/")
        strong Media
        span Sync
    template(slot="start")
      b-navbar-item(tag="router-link" to="/play") Play
      b-navbar-item(tag="router-link" to="/edit") Edit
      b-navbar-item(tag="router-link" to="/browse") Browse
      b-navbar-item(href="https://github.com/patarapolw/mediasync" target="_blank") GitHub
    template(slot="end")
      b-navbar-item(tag="div" v-if="user") Signed in as {{user.email}}
      b-navbar-item(tag="div")
        .buttons
          b-button(v-if="user" type="is-warning" @click="doLogout") Logout
          b-button(v-else type="is-primary" @click="isLoginModal = true") Login
  main
    router-view
  b-modal(:active.sync="isLoginModal" :can-cancel="false")
    div(ref="auth")
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import firebase from 'firebase/app'
import { auth as authUI } from 'firebaseui'

import 'firebase/auth'
import 'firebaseui/dist/firebaseui.css'

let firebaseUI: authUI.AuthUI | null

@Component
export default class App extends Vue {
isDrawer = false
  isLoginModal = false

  get user () {
    return this.$store.state.user
  }

  get isAuthenticated () {
    return this.$store.state.lastStatus !== 401
  }

  @Watch('isLoginModal')
  onLogin () {
    this.$nextTick(() => {
      if (this.$refs.auth) {
        if (!firebaseUI) {
          firebaseUI = new authUI.AuthUI(firebase.auth())
        }

        firebaseUI.start(this.$refs.auth as HTMLDivElement, {
          signInSuccessUrl: this.$router.resolve('/').href,
          signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID
          ],
          signInFlow: 'popup'
        })
      }
    })
  }

  @Watch('isAuthenticated')
  onLogout () {
    if (!this.isAuthenticated) {
      this.isLoginModal = true
    }
  }

  doLogout () {
    firebase.auth().signOut()
  }
}
</script>
