'use strict';

const path = require('path');
// Don't use ESM
// • this will be also required in express app
const pkg = require('./package.json');
const fr = require('./locales/fr').default;
const en = require('./locales/en').default;
const config = require('./packages/server/node.config.js');

module.exports = {
  telemetry: false,
  srcDir: 'packages/ui',
  rootDir: __dirname,
  modulesDir: path.join(__dirname, '/node_modules'),
  dir: {
    assets: 'assets',
    layouts: 'layouts',
    middleware: 'middleware',
    pages: 'routes',
    static: 'static',
    store: 'store',
  },
  build: {
    extend(config) {
      // take care of <i18n> tags inside Vue components
      config.module.rules.push({
        resourceQuery: /blockType=i18n/,
        type: 'javascript/auto',
        loader: '@kazupon/vue-i18n-loader',
      });
    },
  },
  router: {
    middleware: ['maintenance-check', 'authentication-check'],
  },
  plugins: [
    { src: '~/plugins/vue-filters.js', ssr: true },
    { src: '~/plugins/badsender-global-components.js', ssr: true },
    { src: '~/plugins/vue-i18n.js', ssr: true },
    { src: '~/plugins/detect-browser-locale.js', ssr: false },
    { src: '~/plugins/axios-error-handler.js', ssr: false },
  ],
  // https://vuetifyjs.com/en/getting-started/quick-start#nuxt-install
  // https://nuxtjs.org/guide/modules#build-only-modules
  buildModules: ['@nuxtjs/vuetify'],
  vuetify: {
    optionsPath: './vuetify.options.js',
    icons: { iconfont: 'md' },
    theme: {
      options: {
        customProperties: true,
      },
      themes: {
        light: {
          ...config.brandOptions.colors,
        },
      },
    },
    lang: {
      locales: { fr, en },
      current: 'fr',
    },
    // treeShake: true,
  },
  modules: ['@nuxtjs/style-resources', '@nuxtjs/axios'],
  // mirror port in nuxt config
  // • We don't launch a "bare" nuxt server so this might sound not useful
  //   → Server listening is handled by expressJs
  // • BUT this will be used by nuxt-axios
  server: {
    port: config.port,
  },
  axios: {
    prefix: config.nuxt.API_PREFIX,
    browserBaseURL: config.nuxt.API_PREFIX,
  },
  css: [
    '~/assets/global-styles/index.scss',
    '@easylogic/colorpicker/dist/colorpicker.css',
  ],

  treeShake: true,
  env: {
    APP_VERSION: pkg.version,
    ADMIN_USERNAME: config.admin.username,
    API_PREFIX: config.nuxt.API_PREFIX,
    // API_BASE_URL: config.apiBaseURL,
    // // used for dev to call the "stateless" prevision API: /ext/v1
    // EXT_TOKEN: config.extToken,
  },
  head: {
    titleTemplate: 'LePatron Email Builder - %s',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { 'http-equiv': 'X-UA-Compatible', content: 'IE=edge' },
      { name: 'robots', content: 'noindex, nofollow' },
      { rel: 'shortcut icon', href: '/favicon.png', type: 'image/png' },
      { rel: 'icon', href: '/favicon.png', type: 'image/png' },
    ],
    link: [
      {
        rel: 'stylesheet',
        href:
          'https://fonts.googleapis.com/css2?family=Montserrat:wght@100;200;300;400;500;600;700&display=swap,',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css?family=Material+Icons',
      },
    ],
  },
  loading: {
    color: '#87cbc9',
  },
};
