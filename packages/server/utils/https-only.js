'use strict';

// HTTPS everywhere but on a developer's machine: the session cookie is sent
// over HTTPS only, and a browser that came once never tries plain HTTP again
// (HSTS), so a session cookie never travels in clear.

const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// A year, the usual value. No includeSubDomains: other subdomains may serve
// plain HTTP, and are not this application's to decide.
const HSTS = 'max-age=31536000';

/**
 * The options of express-session's cookie.
 *
 * @param {Object} config the application's
 * @returns {Object}
 */
function sessionCookieOptions(config) {
  return {
    maxAge: SESSION_MAX_AGE_MS,
    httpOnly: true,
    secure: !config.isDev,
    // Not sent on a request another site makes; sent when a link of another
    // site opens the application.
    sameSite: 'lax',
  };
}

/**
 * Sends a plain HTTP request to HTTPS, and tells the browser to use HTTPS
 * only. Behind the platform's proxy, the scheme is the forwarded one.
 *
 * @param {Object} config the application's
 * @returns {Function|null} the middleware, none in development
 */
function forceHttps(config) {
  if (config.isDev) return null;
  return (req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    res.setHeader('Strict-Transport-Security', HSTS);
    next();
  };
}

module.exports = { sessionCookieOptions, forceHttps, HSTS };
