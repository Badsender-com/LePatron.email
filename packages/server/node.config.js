'use strict'

const os = require('os')
const path = require('path')
const rc = require('rc')
const _ = require('lodash')
const { mkdirp } = require('fs-extra')

const localEmail = Object.freeze({
  host: `0.0.0.0`,
  port: 1025,
})
// default config is made for an easy use on local dev
const config = rc('badsender', {
  forcessl: false,
  host: `localhost:3000`,
  nuxt: {
    preventBuild: false,
    API_PREFIX: `/api`,
  },
  database: `mongodb://localhost/badsender`,
  sessionSecret: `3MYdqy0lZZz2TXCr7YlxT9N6`,
  emailTransport: {
    ...localEmail,
  },
  brandOptions: {
    colors: {
      primary: `#62a7a5`, // sky blue darkened (better for contrast)
      secondary: `#18223e`, // deep blue
      accent: `#87cbc9`, // sky blue
      // keep the same as default Vuetify
      error: `#ff5252`,
      info: `#2196f3`,
      success: `#4caf50`,
      warning: `#fb8c00`,
    },
    editorIcon: {
      logoPath: `/media/logo_lepatron.png`,
      logoUrl: `/`,
      logoAlt: `Badsender`,
    },
  },
  emailOptions: {
    from: `Badsender local test <info@badsender-local-test.name>`,
    passwordSubjectPrefix: `[badsender email builder]`,
    // last space is needed
    testSubjectPrefix: '[badsender email builder] ',
  },
  storage: {
    type: `local`,
  },
  images: {
    uploadDir: 'uploads',
    tmpDir: 'tmp',
    cache: false,
  },
  admin: {
    id: '576b90a441ceadc005124896',
    username: 'badsender-admin',
    password: 'admin',
  },
  // this is really optional.
  // It's just to be able to backup/restore DB with scripts
  dbConfigs: {
    local: {
      host: 'localhost:27017',
      folder: 'badsender',
    },
  },
  proxyUrl: process.env.QUOTAGUARDSTATIC_URL || 'http://zwaedt4fu4bmis:4ktaahtdb2yeak6x33u5buobusb@us-east-static-01.quotaguard.com:9293'
})

config.NODE_ENV = config.NODE_ENV || process.env.NODE_ENV || 'development'
config.PORT = process.env.PORT || 3000

config.isDev = config.NODE_ENV === 'development'
config.isProd = config.NODE_ENV === 'production'
config.isPreProd = !config.isDev && !config.isProd
config.isAws = config.storage.type === 'aws'

const isLocalEmailTransport =
  config.emailTransport.port === localEmail.port &&
  config.emailTransport.host === localEmail.host

if (config.isDev && isLocalEmailTransport) {
  config.emailTransport = _.merge(
    // on dev mode don't secure connection
    // • prevent NodeMailer `Error: self signed certificate` while using maildev
    //   https://github.com/nodemailer/nodemailer/issues/406#issuecomment-83941225
    {
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
    },
    config.emailTransport
  )
}

// if ( config.isDev ) console.log( config )
// http://stackoverflow.com/questions/12416738/how-to-use-herokus-ephemeral-filesystem
config.setup = new Promise((resolve, reject) => {
  var tmpPath = path.join(`${__dirname}/../../`, config.images.tmpDir)
  var uploadPath = path.join(`${__dirname}/../../`, config.images.uploadDir)
  var tmpDir = mkdirp(tmpPath)
  var uploadDir = config.isAws ? Promise.resolve(null) : mkdirp(uploadPath)

  Promise.all([tmpDir, uploadDir])
    .then(folders => {
      config.images.tmpDir = tmpPath
      config.images.uploadDir = uploadPath
      resolve(config)
    })
    .catch(err => {
      console.log('folder exception')
      console.log('attempt with os.tmpdir()')
      console.log(err)
      var tmpPath = path.join(os.tmpdir(), config.images.tmpDir)
      var uploadPath = path.join(os.tmpdir(), config.images.uploadDir)
      var tmpDir = mkdirp(tmpPath)
      var uploadDir = config.isAws ? Promise.resolve(null) : mkdirp(uploadPath)

      Promise.all([tmpDir, uploadDir])
        .then(folders => {
          console.log('all done with os.tmpdir()')
          config.images.tmpDir = tmpPath
          config.images.uploadDir = uploadPath
          resolve(config)
        })
        .catch(err => {
          reject(err)
          throw err
        })
    })
})

module.exports = config
