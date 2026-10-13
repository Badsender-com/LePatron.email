'use strict';

const { Forbidden } = require('http-errors');

const Roles = require('../account/roles.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * A reviewer reads, comments, approves and sends tests: the routes that write
 * a mailing (create, rename, move, copy, delete, tags, email settings, ignored
 * quality results) refuse them. The editor already hides these actions; this
 * is what holds when the API is called directly. The writer is not restricted
 * here: what a writer may touch inside a mailing is decided by the editor only
 * (ADR 0004).
 */
function GUARD_NOT_REVIEWER(req, res, next) {
  if (req.user?.role === Roles.REVIEWER) {
    return next(new Forbidden(ERROR_CODES.FORBIDDEN_REVIEWER_READ_ONLY));
  }
  return next();
}

module.exports = { GUARD_NOT_REVIEWER };
