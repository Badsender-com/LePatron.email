'use strict';

const path = require('path');
const chalk = require('chalk');
const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const favicon = require('express-favicon');
const passport = require('passport');
const moment = require('moment');
const { Nuxt, Builder } = require('nuxt');

const config = require('./node.config.js');
const nuxtConfig = require('../../nuxt.config.js');
const logger = require('./utils/logger.js');
const versionRouter = require('./version/version.routes');
const groupRouter = require('./group/group.routes');
const mailingRouter = require('./mailing/mailing.routes');
const templateRouter = require('./template/template.routes');
const userRouter = require('./user/user.routes');
const imageRouter = require('./image/image.routes');
const accountRouter = require('./account/account.routes');

const app = express();

const store = new MongoDBStore({
  uri: config.database,
  collection: 'sessions',
});

app.use(
  session({
    secret: config.sessionSecret,
    name: 'badsender.sid',
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

mongoose.connect(config.database, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log(chalk.green('DB Connection open'));
});

app.use(cookieParser());
// fix size error while downloading a zip
// https://stackoverflow.com/a/19965089
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

// enable gzip compression
// • file manager uploads are omitted by this
// • Events routes are omitted from this due to SSE's response cut
//   https://github.com/expressjs/compression#chunksize
const EVENT_ROUTE_REGEX = /\/events$/;
app.use(
  compression({
    // • this param was used for compression to play gracefully with SSE
    //   but it doesn't solve our chunksize issues
    //   https://github.com/expressjs/compression/issues/86#issuecomment-245377396
    // flush: zlib.Z_SYNC_FLUSH,
    filter: (req) => !EVENT_ROUTE_REGEX.test(req.path),
  })
);

app.use(favicon(path.join(__dirname, '../../packages/ui/static/favicon.png')));

// FORCE HTTPS
if (!config.isDev) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https')
      res.redirect(`https://${req.header('host')}${req.url}`);
    else next();
  });
}

// ----- TEMPLATES

// we need to keep a template engine to render Mosaico
// • we could have done it without one…
// • …but for fast refactor this will do for now

app.set('views', path.join(__dirname, './html-templates'));
app.set('view engine', 'pug');

// ----- STATIC

const md5public = require('./md5public.json');
const maxAge = config.isDev
  ? moment.duration(30, 'minutes')
  : moment.duration(1, 'years');
const staticOptions = { maxAge: maxAge.as('milliseconds') };
const compiledStatic = express.static(
  path.join(__dirname, '../../public/dist'),
  staticOptions
);
const compiledStaticNoCache = express.static(
  path.join(__dirname, '../../public/dist')
);
const apiDocumentationNoCache = express.static(
  path.join(__dirname, '../documentation/api')
);

app.locals.md5Url = (url) => {
  // disable md5 on dev
  // better for hot reload
  if (config.isDev) return url;
  if (url in md5public) url = `/${md5public[url]}${url}`;
  return url;
};

function removeHash(req, res, next) {
  const { md5 } = req.params;
  const staticPath = req.url.replace(`/${md5}`, '');
  req._restoreUrl = req.url;
  if (md5public[staticPath] === md5) {
    req.url = staticPath;
    // we don't want statics to be cached by the browser if the md5 is invalid
    // pass it to the next static handler which doesn't set cache
  } else {
    // console.log('[MD5] bad hash for', staticPath, md5)
    req._staticPath = staticPath;
  }
  next();
}

function restoreUrl(req, res, next) {
  // • get here if static middleware fail to find the file
  // • even if the md5 is invalid we ca guess that the file exists
  if (req._staticPath in md5public) {
    // console.log( '[MD5] RESTOREURL – found in md5Public with bad hash', req.url, req._staticPath )
    req.url = req._staticPath;
    // • if not that mean we have an url for another ressource => restore the original url
  } else {
    console.log('[MD5] should be another ressource', req._restoreUrl);
    req.url = req._restoreUrl;
  }
  next();
}

// compiled assets
app.get('/:md5([a-zA-Z0-9]{32})*', removeHash, compiledStatic, restoreUrl);
app.use(compiledStaticNoCache);

// committed assets
app.use(express.static(path.join(__dirname, '../../public')));
// libs
app.use(
  '/lib/skins',
  express.static(path.join(__dirname, '../../public/skins'))
);
// API documentation
app.use('/api/documentation', apiDocumentationNoCache);

// ----- SESSION & I18N

app.use(logger.logRequest());
app.use(logger.logResponse());

app.use(passport.initialize());
app.use(passport.session());

app.get(
  '/account/SAML-login',
  (req, res, next) => {
    if (!req.body.SAMLResponse && !req.query.email) {
      return res.redirect('/');
    }
    next();
  },
  passport.authenticate('saml', { failureRedirect: '/', failureFlash: true }),
  (err, req, res, _next) => {
    console.log({ err });
    const { user } = req;
    if (err) {
      return res.redirect('/');
    }
    console.log({ user });
    return res.redirect('/');
  }
);

app.post(
  '/SAML-login/callback',
  bodyParser.urlencoded({ extended: false }),
  passport.authenticate('saml', { failureRedirect: '/', failureFlash: true }),
  function (req, res) {
    res.redirect('/');
  }
);

app.post(
  '/account/login/admin/',
  passport.authenticate('local', {
    successReturnToOrRedirect: '/groups',
    failureRedirect: '/account/login/admin',
    failureFlash: true,
    successFlash: true,
  })
);
app.get('/account/logout', (req, res) => {
  req.logout();
  res.redirect('/account/login');
});

// Passport configuration
const { GUARD_USER_REDIRECT } = require('./account/auth.guard.js');

// API routes
app.use('/api/groups', groupRouter);
app.use('/api/mailings', mailingRouter);
app.use('/api/templates', templateRouter);
app.use('/api/users', userRouter);
app.use('/api/images', imageRouter);
app.use('/api/account', accountRouter);
app.use('/api/version', versionRouter);

// Mosaico's editor route
const mosaicoEditor = require('./mailing/mosaico-editor.controller.js');
app.get(
  '/mailings/:mailingId',
  GUARD_USER_REDIRECT,
  GUARD_USER_REDIRECT,
  mosaicoEditor.exposeHelpersToPug,
  mosaicoEditor.render
);

const nuxt = new Nuxt(nuxtConfig);
const isNuxtReady =
  config.isDev && !config.nuxt.preventBuild
    ? new Builder(nuxt).build()
    : nuxt.ready();
isNuxtReady.then(() => logger.info('Nuxt initialized'));

app.use(nuxt.render);

app.use(function apiErrorHandler(err, req, res) {
  logger.error(err);
  // delete err.config;
  // anything can come here
  // • make sure we have the minimum error informations
  const errStatus = err.status || err.statusCode || (err.status = 500);
  const errMessage = err.message || 'an error as occurred';
  const stack = err.stack ? err.stack : new Error(err).stack;
  const errStack = stack.split('\n').map((line) => line.trim());
  const errorResponse = {
    ...err,
    status: errStatus,
    message: errMessage,
  };
  // we don't want the stack to leak in production mode
  if (config.isDev) errorResponse.stack = errStack;
  res.status(errStatus).json(errorResponse);
});

app.listen(config.PORT, () => {
  console.log(
    chalk.green('API is listening on port'),
    chalk.cyan(config.PORT),
    chalk.green('on mode'),
    chalk.cyan(config.NODE_ENV)
  );
});
