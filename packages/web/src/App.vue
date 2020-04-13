<template lang="pug">
#App
  b-navbar
    template(slot="brand")
      b-navbar-item(tag="router-link" to="/")
        strong Media
        span Sync
    template(slot="start")
      b-navbar-item(tag="router-link" to="/play") Play
      b-navbar-item(tag="router-link" to="/edit") Edit
      b-navbar-item(tag="router-link" to="/browse") Browse
      b-navbar-item(href="https://github.com/patarapolw" target="_blank") GitHub
    template(slot="end")
      b-navbar-item(tag="div" v-if="user") Signed in as {{user.email}}
      b-navbar-item(tag="div")
        .buttons
          b-button(v-if="user" type="is-warning" @click="doLogout") Logout
          b-button(v-else type="is-primary" @click="doLogin") Login
</template>
