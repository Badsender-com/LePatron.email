module.exports = {
  build: {
    templates: {
      source: 'components',
      destination: {
        path: 'build_local',
      },
    },
    components: {
      root: 'components',
      folders: ['core'],
    },
  },
  inlineCSS: false,  // Désactivé par défaut (mode preview)
  removeUnusedCSS: false,
  minify: false,
  prettify: false,
  browsersync: false,  // Pas de BrowserSync pour le POC
}
