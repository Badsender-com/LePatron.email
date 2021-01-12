'use strict'

const path = require('path')
const chalk = require('chalk')
const bodyParser = require('body-parser')
const express = require('express')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const compression = require('compression')
const favicon = require('express-favicon')
// Connect-mongo raise some warnings
//  • DeprecationWarning: collection.update is deprecated. Use updateOne, updateMany, or bulkWrite instead.
//  • https://github.com/jdesboeufs/connect-mongo/issues/300
const MongoStore = require('connect-mongo')(session)
const passport = require('passport')
const moment = require('moment')

const config = require('./node.config.js')
const services = require('./services/initialization.js')
const logger = require('./services/logger.js')
const { mongoose } = require('./services/models.js')
const apiRouter = require('./routes-api.js')

module.exports = function launchServer() {
  const app = express()

  app.use(cookieParser())
  // fix size error while downloading a zip
  // https://stackoverflow.com/a/19965089
  app.use(bodyParser.json({ limit: `50mb` }))
  app.use(bodyParser.urlencoded({ limit: `50mb`, extended: false }))

  // enable gzip compression
  // • file manager uploads are omitted by this
  // • Events routes are omitted from this due to SSE's response cut
  //   https://github.com/expressjs/compression#chunksize
  const EVENT_ROUTE_REGEX = /\/events$/
  app.use(
    compression({
      // • this param was used for compression to play gracefully with SSE
      //   but it doesn't solve our chunksize issues
      //   https://github.com/expressjs/compression/issues/86#issuecomment-245377396
      // flush: zlib.Z_SYNC_FLUSH,
      filter: (req, res) => !EVENT_ROUTE_REGEX.test(req.path),
    }),
  )

  app.use(favicon(path.join(__dirname, `../../packages/ui/static/favicon.png`)))

  // FORCE HTTPS
  if (!config.isDev) {
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https')
        res.redirect(`https://${req.header('host')}${req.url}`)
      else next()
    })
  }

  //----- TEMPLATES

  // we need to keep a template engine to render Mosaico
  // • we could have done it without one…
  // • …but for fast refactor this will do for now

  app.set(`views`, path.join(__dirname, `./html-templates`))
  app.set(`view engine`, `pug`)

  //----- STATIC

  const md5public = require('./md5public.json')
  const maxAge = config.isDev
    ? moment.duration(30, `minutes`)
    : moment.duration(1, `years`)
  const staticOptions = { maxAge: maxAge.as(`milliseconds`) }
  const compiledStatic = express.static(
    path.join(__dirname, `../../public/dist`),
    staticOptions,
  )
  const compiledStaticNoCache = express.static(
    path.join(__dirname, `../../public/dist`),
  )
  const apiDocumentationNoCache = express.static(
    path.join(__dirname, `../documentation/api`),
  )

  app.locals.md5Url = (url) => {
    // disable md5 on dev
    // better for hot reload
    if (config.isDev) return url
    if (url in md5public) url = `/${md5public[url]}${url}`
    return url
  }

  function removeHash(req, res, next) {
    const { md5 } = req.params
    const staticPath = req.url.replace(`/${md5}`, '')
    req._restoreUrl = req.url
    if (md5public[staticPath] === md5) {
      req.url = staticPath
      // we don't want statics to be cached by the browser if the md5 is invalid
      // pass it to the next static handler which doesn't set cache
    } else {
      // console.log('[MD5] bad hash for', staticPath, md5)
      req._staticPath = staticPath
    }
    next()
  }

  function restoreUrl(req, res, next) {
    // • get here if static middleware fail to find the file
    // • even if the md5 is invalid we ca guess that the file exists
    if (req._staticPath in md5public) {
      // console.log( '[MD5] RESTOREURL – found in md5Public with bad hash', req.url, req._staticPath )
      req.url = req._staticPath
      // • if not that mean we have an url for another ressource => restore the original url
    } else {
      console.log(`[MD5] should be another ressource`, req._restoreUrl)
      req.url = req._restoreUrl
    }
    next()
  }

  // compiled assets
  app.get(`/:md5([a-zA-Z0-9]{32})*`, removeHash, compiledStatic, restoreUrl)
  app.use(compiledStaticNoCache)

  // committed assets
  app.use(express.static(path.join(__dirname, `../../public`)))
  // libs
  app.use(
    '/lib/skins',
    express.static(path.join(__dirname, `../../public/skins`)),
  )
  // API documentation
  app.use(`/api/documentation`, apiDocumentationNoCache)

  //----- SESSION & I18N

  app.use(logger.logRequest())
  app.use(logger.logResponse())

  app.use(
    session({
      name: `badsender.sid`,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new MongoStore({ mongooseConnection: mongoose.connection }),
    }),
  )
  app.use(passport.initialize())
  app.use(passport.session())

  app.post(
    `/account/login`,
    passport.authenticate(`local`, {
      successReturnToOrRedirect: `/`,
      failureRedirect: `/account/login`,
    }),
  )
  app.post(
    `/account/login/admin/`,
    passport.authenticate(`local`, {
      successReturnToOrRedirect: `/groups`,
      failureRedirect: `/account/login/admin`,
      failureFlash: true,
      successFlash: true,
    }),
  )
  app.get(`/account/logout`, (req, res) => {
    req.logout()
    res.redirect(`/account/login`)
  })

  // The code below is a WIP of oauth2 authentication
  // • this should be used to protect the API when consumed outside the context of application

  // const oauthRoutes = require('./routes-oauth2')

  // // should be called with /dialog/authorize?response_type=code or /dialog/authorize?response_type=token
  // // &client_id=" + CLIENT_ID+ "&redirect_uri=" + CALLBACK_URL + "
  // // https://github.com/awais786327/oauth2orize-examples/issues/8#issuecomment-393417492
  // app.get('/dialog/authorize', oauthRoutes.authorization)
  // // internal route
  // app.post('/dialog/authorize/decision', oauthRoutes.decision)
  // app.post('/oauth/token', oauthRoutes.token)

  // app.get('/api/userinfo', [
  //   passport.authenticate('bearer', { session: false }),
  //   (req, res) => {
  //     // req.authInfo is set using the `info` argument supplied by
  //     // `BearerStrategy`. It is typically used to indicate scope of the token,
  //     // and used in access control checks. For illustrative purposes, this
  //     // example simply returns the scope in the response.
  //     res.json({
  //       user_id: req.user.id,
  //       name: req.user.name,
  //       scope: req.authInfo.scope,
  //     })
  //   },
  // ])
  // app.get('/api/clientinfo', [
  //   passport.authenticate('bearer', { session: false }),
  //   (req, res) => {
  //     // req.authInfo is set using the `info` argument supplied by
  //     // `BearerStrategy`. It is typically used to indicate scope of the token,
  //     // and used in access control checks. For illustrative purposes, this
  //     // example simply returns the scope in the response.
  //     res.json({
  //       client_id: req.user.id,
  //       name: req.user.name,
  //       scope: req.authInfo.scope,
  //     })
  //   },
  // ])

  // Passport configuration
  const { GUARD_USER_REDIRECT } = require('./services/authentication.js')

  // API routes
  app.use(`/api`, apiRouter)

  // Mosaico's editor route
  const mosaicoEditor = require('./controllers/mailings/mosaico-editor.js')
  app.get(
    `/mailings/:mailingId`,
    GUARD_USER_REDIRECT,
    mosaicoEditor.exposeHelpersToPug,
    mosaicoEditor.render,
  )

  // app.use(function exposeUserToNuxt(req, res, next) {
  //   // console.log(Object.keys(req))
  //   console.log({ user: req.user })
  //   next()
  // })

  // NUXT integration
  // https://github.com/nuxt/create-nuxt-app/blob/master/template/frameworks/express/server/index.js
  const { Nuxt, Builder } = require('nuxt')
  const nuxtConfig = require('../../nuxt.config.js')
  const nuxt = new Nuxt(nuxtConfig)
  const isNuxtReady =
    config.isDev && !config.nuxt.preventBuild
      ? new Builder(nuxt).build()
      : nuxt.ready()
  isNuxtReady.then(() => logger.info(`Nuxt initialized`))
  app.use(nuxt.render)

  app.use(function apiErrorHandler(err, req, res, next) {
    logger.error(err)
    // delete err.config;
    // anything can come here
    // • make sure we have the minimum error informations
    const errStatus = err.status || err.statusCode || (err.status = 500)
    const errMessage = err.message || `an error as occurred`
    const stack = err.stack ? err.stack : new Error(err).stack
    const errStack = stack.split(`\n`).map((line) => line.trim())
    const errorResponse = {
      ...err,
      status: errStatus,
      message: errMessage,
    }
    // we don't want the stack to leak in production mode
    if (config.isDev) errorResponse.stack = errStack
    res.status(errStatus).json(errorResponse)
  })

  services.areReady.then((serviceStatus) => {
    if (!serviceStatus) {
      return console.log(chalk.red(`[API] impossible to launch server`))
    }
    app.listen(config.PORT, function endInit() {
      console.log(
        chalk.green(`API is listening on port`),
        // chalk.cyan(app.address().port),
        chalk.cyan(config.PORT),
        chalk.green(`on mode`),
        chalk.cyan(config.NODE_ENV),
      )
    })
  })
}
