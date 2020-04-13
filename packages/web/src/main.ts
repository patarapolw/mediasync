import Vue from 'vue'
import dayjs from 'dayjs'
import firebase from 'firebase/app'

import 'firebase/analytics'
import 'firebase/auth'
import 'firebase/firestore'

import App from './App.vue'
import router from './router'
import store from './store'

import './plugins/buefy'
import './plugins/fontawesome'
import './plugins/codemirror'

firebase.initializeApp(require('../firebase.config'))

Vue.config.productionTip = false

Vue.filter('format', (v: any) => {
  if (typeof v === 'number') {
    return (v || v === 0) ? v.toLocaleString() : ''
  } else if (v instanceof Date) {
    return dayjs(v).format('YYYY-MM-DD HH:mm')
  } else if (v && typeof v === 'object') {
    return JSON.stringify(v)
  }
  return v
})

Vue.filter('formatDate', (v: any) => {
  return dayjs(v).format('YYYY-MM-DD HH:mm')
})

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')

firebase.auth().onAuthStateChanged((user) => {
  store.commit('setUser', user)
})
