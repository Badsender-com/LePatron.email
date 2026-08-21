'use strict';

const createError = require('http-errors');
const { Groups } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');

/**
 * Middleware that rejects the request when the caller's company has
 * `emailMetadata.enabled` set to false.
 *
 * Without it the flag would be decorative: the fields it gates end up in the
 * mailing document and in the template's own `data`, so a request bypassing the
 * UI would populate a feature the company has not turned on. Modelled on
 * GUARD_EMAIL_BUILDER, including the super-admin bypass.
 *
 * Opposite default from GUARD_EMAIL_BUILDER: this feature is off unless a company
 * opts in, so `undefined` (companies predating the flag) means disabled.
 *
 * Must be used after a GUARD_USER-style middleware (requires `req.user`).
 */
async function guardEmailMetadata(req, res, next) {
  try {
    const { user } = req;

    if (!user) {
      return next(createError(401));
    }

    if (user.isAdmin) {
      return next();
    }

    if (!user.group || !user.group.id) {
      return next(createError(400, ERROR_CODES.GROUP_NOT_FOUND));
    }

    const group = await Groups.findById(user.group.id)
      .select('emailMetadata')
      .lean();

    if (!group) {
      return next(createError(404, ERROR_CODES.GROUP_NOT_FOUND));
    }

    if (group.emailMetadata?.enabled !== true) {
      return next(createError(403, ERROR_CODES.EMAIL_METADATA_DISABLED));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  GUARD_EMAIL_METADATA: guardEmailMetadata,
};
