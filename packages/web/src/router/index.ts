import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const router = new VueRouter({
  mode: 'history',
  routes: [
    {
      path: '/play',
      alias: '/',
      name: 'playDefault',
      component: () => import(/* webpackChunkName: "play" */ '../views/Play.vue')
    },
    {
      path: '/play/:name',
      name: 'playChoice',
      component: () => import(/* webpackChunkName: "play" */ '../views/Play.vue')
    },
    {
      path: '/edit',
      name: 'edit',
      component: () => import(/* webpackChunkName: "edit" */ '../views/Edit.vue')
    }
  ]
})

export default router
