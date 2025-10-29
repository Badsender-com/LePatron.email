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

const terminate = require('./utils/terminate.js');
const cluster = require('cluster');

const config = require('./node.config.js');
const nuxtConfig = require('../../nuxt.config.js');
const logger = require('./utils/logger.js');
const versionRouter = require('./version/version.routes');
const groupRouter = require('./group/group.routes');
const workspaceRouter = require('./workspace/workspace.routes');
const personalizedBlockRouter = require('./personalized-blocks/personalized-block-routes.js');
const folderRouter = require('./folder/folder.routes');
const profileRouter = require('./profile/profile.routes');
const mailingRouter = require('./mailing/mailing.routes');
const templateRouter = require('./template/template.routes');
const userRouter = require('./user/user.routes');
const imageRouter = require('./image/image.routes');
const accountRouter = require('./account/account.routes');
const EmailGroupRouter = require('./emails-group/emails-group.routes');

process.env.TMPDIR = path.join(process.env.HOME, 'badsender-vips');

const workers =
  process.env.WORKERS <= require('os').cpus().length ? process.env.WORKERS : 1;

if (cluster.isMaster) {
  logger.log(chalk.cyan('start cluster with %s workers'), workers);

  for (let i = 0; i < workers; ++i) {
    const worker = cluster.fork().process;
    logger.log(chalk.green('worker %s started.'), worker.pid);
  }

  cluster.on('exit', function (worker) {
    logger.log(
      chalk.bgYellow('worker %s died. restart...'),
      worker.process.pid
    );
    cluster.fork();
  });
} else {
  const app = express();

  // Trust first proxy to correctly identify HTTPS connections
  // This allows Express to read X-Forwarded-Proto header from load balancer/proxy
  // Required for secure cookies to work properly behind proxies
  if (!config.isDev) {
    app.set('trust proxy', 1);
  }

  const store = new MongoDBStore({
    uri: config.database,
    collection: 'sessions',
    expires: config.session.maxAge, // Auto-cleanup expired sessions
  });

  // Handle session store errors
  store.on('error', (error) => {
    console.error('Session store error:', error);
  });

  app.use(
    session({
      secret: config.sessionSecret,
      name: 'badsender.sid',
      resave: false,
      saveUninitialized: false,
      store: store,
      cookie: {
        maxAge: config.session.maxAge, // 14 days by default
        httpOnly: true, // Prevents JavaScript access to cookies (XSS protection)
        secure: !config.isDev, // HTTPS only in production
        sameSite: 'lax', // CSRF protection
      },
      rolling: true, // Reset expiration on each request (idle timeout behavior)
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

  app.use(
    favicon(path.join(__dirname, '../../packages/ui/static/favicon.png'))
  );

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

  const removeHash = (req, res, next) => {
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
  };

  const restoreUrl = (req, res, next) => {
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
  };

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

  // Enforce unique session per user (except admin)
  const { enforceUniqueSession } = require('./account/session.middleware.js');

  // List of public routes that should NOT enforce unique session
  // These routes are accessible without authentication or during login process
  const PUBLIC_PATHS = [
    '/account/login',           // Login page
    '/account/SAML-login',      // SAML login initiator
    '/SAML-login/callback',     // SAML callback
    '/api/account/login',       // API login endpoint
    '/api/account/',            // All public account API routes (profile, forgot password, etc.)
  ];

  // Apply enforceUniqueSession conditionally
  app.use((req, res, next) => {
    // Skip unique session enforcement for public paths
    const isPublicPath = PUBLIC_PATHS.some(path => req.path.startsWith(path));

    if (isPublicPath) {
      // Allow public routes to proceed without session validation
      return next();
    }

    // Apply unique session enforcement for all other routes
    return enforceUniqueSession(req, res, next);
  });

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
      if (err) {
        return res.redirect('/');
      }
      return res.redirect('/');
    }
  );

  const { createLoginSuccessHandler } = require('./account/session.middleware.js');

  app.post(
    '/SAML-login/callback',
    bodyParser.urlencoded({ extended: false }),
    passport.authenticate('saml', { failureRedirect: '/', failureFlash: true }),
    createLoginSuccessHandler('saml'),
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
    }),
    createLoginSuccessHandler('local')
  );

  app.get('/account/logout', async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.sessionID;
    const isAdmin = req.user ? req.user.isAdmin : false;

    console.log('[LOGOUT] Starting logout process for user:', userId);

    // Clear activeSessionId in user document (except for admin)
    if (userId && !isAdmin) {
      try {
        const { Users } = require('./common/models.common.js');
        const user = await Users.findById(userId).select('+activeSessionId');
        if (user) {
          user.activeSessionId = null;
          await user.save();
          console.log('[LOGOUT] Cleared activeSessionId for user:', userId);
        }
      } catch (error) {
        console.error('[LOGOUT] Error clearing activeSessionId:', error);
      }
    }

    // Log the session destruction
    if (userId) {
      try {
        const { logSessionDestroyed } = require('./utils/session.logger.js');
        logSessionDestroyed({
          userId,
          sessionId,
          reason: 'manual_logout',
        });
        console.log('[LOGOUT] Logged session destruction');
      } catch (error) {
        console.error('[LOGOUT] Error logging session destruction:', error);
      }
    }

    // Create a timeout to ensure response is sent
    let responseSent = false;
    const timeoutId = setTimeout(() => {
      if (!responseSent) {
        console.error('[LOGOUT] Timeout reached, forcing redirect');
        responseSent = true;
        res.clearCookie('badsender.sid');
        res.redirect('/account/login');
      }
    }, 5000); // 5 second timeout

    try {
      console.log('[LOGOUT] Calling req.logout()');

      // Call req.logout without waiting for callback (callback hangs in passport 0.4.1)
      // Just call it to clear req.user, but don't wait
      try {
        if (typeof req.logout === 'function') {
          req.logout(() => {
            console.log('[LOGOUT] Passport logout callback fired (async)');
          });
          console.log('[LOGOUT] Passport logout called (not waiting for callback)');
        }
      } catch (logoutError) {
        console.error('[LOGOUT] Passport logout error:', logoutError);
      }

      // Proceed immediately to destroy session without waiting for passport
      console.log('[LOGOUT] Calling req.session.destroy()');

      // Use promise wrapper for session.destroy with timeout
      await new Promise((resolve) => {
        const destroyTimeout = setTimeout(() => {
          console.warn('[LOGOUT] Session destroy timeout (3s), continuing anyway');
          resolve();
        }, 3000);

        if (!req.session) {
          console.warn('[LOGOUT] No session to destroy');
          clearTimeout(destroyTimeout);
          resolve();
          return;
        }

        req.session.destroy((err) => {
          clearTimeout(destroyTimeout);
          if (err) {
            console.error('[LOGOUT] Session destruction error:', err);
          } else {
            console.log('[LOGOUT] Session destroyed successfully');
          }
          resolve(); // Always resolve, even on error
        });
      });

    } catch (error) {
      console.error('[LOGOUT] Error during logout process:', error);
    }

    // Clear timeout and send response
    clearTimeout(timeoutId);

    if (!responseSent) {
      console.log('[LOGOUT] Sending redirect response');
      responseSent = true;
      res.clearCookie('badsender.sid');
      res.redirect('/account/login');
    }
  });

  // Passport configuration
  const { GUARD_USER_REDIRECT } = require('./account/auth.guard.js');

  // API routes
  app.use('/api/folders', folderRouter);
  app.use('/api/profiles', profileRouter);
  app.use('/api/workspaces', workspaceRouter);
  app.use('/api/personalized-blocks', personalizedBlockRouter);
  app.use('/api/groups', groupRouter);
  app.use('/api/mailings', mailingRouter);
  app.use('/api/templates', templateRouter);
  app.use('/api/users', userRouter);
  app.use('/api/images', imageRouter);
  app.use('/api/emails-groups', EmailGroupRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/version', versionRouter);

  // Mosaico's editor route
  const mosaicoEditor = require('./mailing/mosaico-editor.controller.js');
  app.get(
    '/editor/:mailingId',
    GUARD_USER_REDIRECT,
    mosaicoEditor.exposeHelpersToPug,
    mosaicoEditor.render
  );

  const maintenanceEditor = require('./maintenance/maintenance.controller.js');
  app.get(
    '/maintenance',
    // maintenanceEditor.exposeHelpersToPug,
    maintenanceEditor.render
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

  const server = app.listen(config.PORT, () => {
    console.log(
      chalk.green('API is listening on port'),
      chalk.cyan(config.PORT),
      chalk.green('on mode'),
      chalk.cyan(config.NODE_ENV)
    );
  });

  const exitHandler = terminate(server, {
    coredump: false,
    timeout: 500,
  });
  //

  process.on('SIGTERM', exitHandler(0, 'SIGTERM'));
  process.on('SIGINT', exitHandler(0, 'SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    exitHandler(1, 'Uncaught exception');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED PROMISE REJECTION:', reason);
    exitHandler(1, 'Unhandled promise');
  });

  process.stdout.on('error', function (err) {
    if (err.code === 'EPIPE') {
      exitHandler(1, 'EPIPE Exception');
    }
  });
}
