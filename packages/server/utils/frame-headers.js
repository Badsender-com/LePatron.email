'use strict';

// Only the application frames its own pages and API answers: the editor and
// the previews frame same-origin documents, nothing else is meant to.
//
// The images under /api/images are left out: sent emails, webmails and other
// sites load them from anywhere. The static assets are served before this
// middleware runs (index.js).

const FRAME_ANCESTORS = "frame-ancestors 'self'";
const EMBEDDABLE_PREFIX = '/api/images';

const isEmbeddable = (path) =>
  path === EMBEDDABLE_PREFIX || path.startsWith(`${EMBEDDABLE_PREFIX}/`);

/**
 * Express middleware: the answer may only be framed by a page of the same
 * origin. X-Frame-Options for the browsers that do not read frame-ancestors.
 */
function sameOriginFraming(req, res, next) {
  if (isEmbeddable(req.path)) return next();
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Content-Security-Policy', FRAME_ANCESTORS);
  next();
}

module.exports = { sameOriginFraming, FRAME_ANCESTORS };
