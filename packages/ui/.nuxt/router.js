import Vue from 'vue'
import Router from 'vue-router'
import { interopDefault } from './utils'
import scrollBehavior from './router.scrollBehavior.js'

const _11aff502 = () => interopDefault(import('../routes/404.vue' /* webpackChunkName: "routes/404" */))
const _57112a06 = () => interopDefault(import('../routes/groups/index.vue' /* webpackChunkName: "routes/groups/index" */))
const _9304689e = () => interopDefault(import('../routes/mailings/index.vue' /* webpackChunkName: "routes/mailings/index" */))
const _32e95d74 = () => interopDefault(import('../routes/templates/index.vue' /* webpackChunkName: "routes/templates/index" */))
const _00f7e356 = () => interopDefault(import('../routes/users/index.vue' /* webpackChunkName: "routes/users/index" */))
const _720f2fb7 = () => interopDefault(import('../routes/account/admin.vue' /* webpackChunkName: "routes/account/admin" */))
const _e41836d8 = () => interopDefault(import('../routes/account/login/index.vue' /* webpackChunkName: "routes/account/login/index" */))
const _5076c821 = () => interopDefault(import('../routes/account/reset-password.vue' /* webpackChunkName: "routes/account/reset-password" */))
const _08b844ea = () => interopDefault(import('../routes/groups/new.vue' /* webpackChunkName: "routes/groups/new" */))
const _1572db3f = () => interopDefault(import('../routes/mailings/new.vue' /* webpackChunkName: "routes/mailings/new" */))
const _81398ede = () => interopDefault(import('../routes/account/login/admin.vue' /* webpackChunkName: "routes/account/login/admin" */))
const _1fc6ae3a = () => interopDefault(import('../routes/groups/_groupId/index.vue' /* webpackChunkName: "routes/groups/_groupId/index" */))
const _49feb748 = () => interopDefault(import('../routes/templates/_templateId.vue' /* webpackChunkName: "routes/templates/_templateId" */))
const _a9417eb0 = () => interopDefault(import('../routes/users/_userId.vue' /* webpackChunkName: "routes/users/_userId" */))
const _7e447ef4 = () => interopDefault(import('../routes/groups/_groupId/new-template.vue' /* webpackChunkName: "routes/groups/_groupId/new-template" */))
const _bd8dad52 = () => interopDefault(import('../routes/groups/_groupId/new-user.vue' /* webpackChunkName: "routes/groups/_groupId/new-user" */))
const _23d664c4 = () => interopDefault(import('../routes/account/_email/password/_token.vue' /* webpackChunkName: "routes/account/_email/password/_token" */))
const _ed8719c8 = () => interopDefault(import('../routes/index.vue' /* webpackChunkName: "routes/index" */))

// TODO: remove in Nuxt 3
const emptyFn = () => {}
const originalPush = Router.prototype.push
Router.prototype.push = function push (location, onComplete = emptyFn, onAbort) {
  return originalPush.call(this, location, onComplete, onAbort)
}

Vue.use(Router)

export const routerOptions = {
  mode: 'history',
  base: decodeURI('/'),
  linkActiveClass: 'nuxt-link-active',
  linkExactActiveClass: 'nuxt-link-exact-active',
  scrollBehavior,

  routes: [{
    path: "/404",
    component: _11aff502,
    name: "404"
  }, {
    path: "/groups",
    component: _57112a06,
    name: "groups"
  }, {
    path: "/mailings",
    component: _9304689e,
    name: "mailings"
  }, {
    path: "/templates",
    component: _32e95d74,
    name: "templates"
  }, {
    path: "/users",
    component: _00f7e356,
    name: "users"
  }, {
    path: "/account/admin",
    component: _720f2fb7,
    name: "account-admin"
  }, {
    path: "/account/login",
    component: _e41836d8,
    name: "account-login"
  }, {
    path: "/account/reset-password",
    component: _5076c821,
    name: "account-reset-password"
  }, {
    path: "/groups/new",
    component: _08b844ea,
    name: "groups-new"
  }, {
    path: "/mailings/new",
    component: _1572db3f,
    name: "mailings-new"
  }, {
    path: "/account/login/admin",
    component: _81398ede,
    name: "account-login-admin"
  }, {
    path: "/groups/:groupId",
    component: _1fc6ae3a,
    name: "groups-groupId"
  }, {
    path: "/templates/:templateId",
    component: _49feb748,
    name: "templates-templateId"
  }, {
    path: "/users/:userId",
    component: _a9417eb0,
    name: "users-userId"
  }, {
    path: "/groups/:groupId/new-template",
    component: _7e447ef4,
    name: "groups-groupId-new-template"
  }, {
    path: "/groups/:groupId/new-user",
    component: _bd8dad52,
    name: "groups-groupId-new-user"
  }, {
    path: "/account/:email?/password/:token?",
    component: _23d664c4,
    name: "account-email-password-token"
  }, {
    path: "/",
    component: _ed8719c8,
    name: "index"
  }],

  fallback: false
}

export function createRouter () {
  return new Router(routerOptions)
}
