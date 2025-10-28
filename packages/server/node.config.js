'use strict';

const os = require('os');
const path = require('path');
const rc = require('rc');
const _ = require('lodash');
require('dotenv').config();
const { mkdirp } = require('fs-extra');

const localEmail = Object.freeze({
  host: '0.0.0.0',
  port: 1025,
});

// default config is made for an easy use on local dev
const config = rc('lepatron', {
  forcessl: false,
  host: 'localhost:3000',
  nuxt: {
    preventBuild: false,
    API_PREFIX: '/api',
  },
  database: 'mongodb://localhost:27017/lepatron',
  sessionSecret: '3MYdqy0lZZz2TXCr7YlxT9N6',
  emailTransport: {
    ...localEmail,
  },
  brandOptions: {
    colors: {
      primary: '#093040', // sky blue darkened (better for contrast)
      secondary: '#265090', // deep blue
      accent: '#00ACDC', // sky blue
      // keep the same as default Vuetify
      error: '#ff5252',
      info: '#2196f3',
      success: '#4caf50',
      warning: '#fb8c00',
    },
    editorIcon: {
      logoPath: '/media/logo_lepatron.png',
      logoUrl: '/',
      logoAlt: 'LePatron.email',
    },
  },
  emailOptions: {
    from: 'LePatron.email local test <info@lepatron-local-test.name>',
    passwordSubjectPrefix: 'Email builder LePatron',
  },
  storage: {
    type: 'local',
  },
  images: {
    uploadDir: 'uploads',
    tmpDir: 'tmp',
    cache: false,
  },
  admin: {
    id: '576b90a441ceadc005124896',
    username: 'admin',
    password: 'admin',
  },
  session: {
    // Session duration in days (configurable via environment variable)
    durationDays: parseInt(process.env.SESSION_DURATION_DAYS || '14', 10),
    // Enable session logging
    enableLogging: process.env.SESSION_LOGGING !== 'false',
  },
  proxyUrl: process.env.QUOTAGUARDSTATIC_URL,
  dscUrl: process.env.DSC_ESP_URL,
  dscUserAgent: process.env.DSC_USER_AGENT,
  adobeDefaultImsUrl: process.env.NUXT_ENV_ADOBE_DEFAULT_IMS_URL,
  adobeDefaultUser: process.env.ADOBE_DEFAULT_USER,
  encryptionKey: process.env.ENCRYPTION_KEY,
  NODE_ENV: process.env.NODE_ENV,
});

config.NODE_ENV = config.NODE_ENV || process.env.NODE_ENV || 'development';
config.PORT = process.env.PORT || 3000;

config.isDev = config.NODE_ENV === 'development';
config.isProd = config.NODE_ENV === 'production';
config.isPreProd = !config.isDev && !config.isProd;
config.isAws = config.storage.type === 'aws';

// Calculate session maxAge in milliseconds
config.session.maxAge = config.session.durationDays * 24 * 60 * 60 * 1000;

const isLocalEmailTransport =
  config.emailTransport.port === localEmail.port &&
  config.emailTransport.host === localEmail.host;

if (!config.isDev) {
  config.emailTransport = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };
} else if (config.isDev && isLocalEmailTransport) {
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
  );
}

// if ( config.isDev ) console.log( config )
// http://stackoverflow.com/questions/12416738/how-to-use-herokus-ephemeral-filesystem
config.setup = new Promise((resolve, reject) => {
  const tmpPath = path.join(__dirname, '../../', config.images.tmpDir);
  const uploadPath = path.join(__dirname, '../../', config.images.uploadDir);
  const tmpDir = mkdirp(tmpPath);
  const uploadDir = config.isAws ? Promise.resolve(null) : mkdirp(uploadPath);

  Promise.all([tmpDir, uploadDir])
    .then(() => {
      config.images.tmpDir = tmpPath;
      config.images.uploadDir = uploadPath;
      resolve(config);
    })
    .catch((err) => {
      console.log('folder exception');
      console.log('attempt with os.tmpdir()');
      console.log(err);
      const tmpPath = path.join(os.tmpdir(), config.images.tmpDir);
      const uploadPath = path.join(os.tmpdir(), config.images.uploadDir);
      const tmpDir = mkdirp(tmpPath);
      const uploadDir = config.isAws
        ? Promise.resolve(null)
        : mkdirp(uploadPath);

      Promise.all([tmpDir, uploadDir])
        .then(() => {
          console.log('all done with os.tmpdir()');
          config.images.tmpDir = tmpPath;
          config.images.uploadDir = uploadPath;
          resolve(config);
        })
        .catch((err) => {
          reject(err);
          throw err;
        });
    });
});

module.exports = config;
