'use strict';

const { UnsupportedMediaType } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

// For the routes that act on what the request carries — export it, push it to
// a CDN or FTP, send it by email — rather than on stored data.
//
// The session cookie rides along with any request to the app, including a
// plain HTML form posted from another site, and the app parses url-encoded
// bodies everywhere. A browser only sends `application/json` cross-site after
// a CORS preflight the app does not grant, so requiring it keeps these routes
// to the app's own pages. Every client of these routes already sends JSON
// (the editor through $.ajax and axios, the mailing list through axios, the
// editor's ESP dialog through axios for send-campaign-mail).

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {Function} next
 */
function requireJsonBody(req, _res, next) {
  if (req.is('application/json')) return next();
  return next(new UnsupportedMediaType(ERROR_CODES.JSON_BODY_REQUIRED));
}

module.exports = { requireJsonBody };
