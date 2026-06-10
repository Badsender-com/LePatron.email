'use strict';

const createError = require('http-errors');
const { Groups } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');

/**
 * Middleware that rejects the request when the caller's group has
 * `enableEmailBuilder` set to false. Super admins bypass the check so that
 * platform-wide operations still work on a group that has the module disabled.
 *
 * Must be used after a GUARD_USER-style middleware (requires `req.user`).
 */
async function guardEmailBuilder(req, res, next) {
  try {
    const { user } = req;

    if (!user) {
      return next(createError(401));
    }

    // Super admins must keep platform-wide access regardless of the per-group flag.
    if (user.isAdmin) {
      return next();
    }

    if (!user.group || !user.group.id) {
      return next(createError(400, ERROR_CODES.GROUP_NOT_FOUND));
    }

    const group = await Groups.findById(user.group.id)
      .select('enableEmailBuilder')
      .lean();

    if (!group) {
      return next(createError(404, ERROR_CODES.GROUP_NOT_FOUND));
    }

    // Treat `undefined` (legacy groups predating the flag) as enabled — the
    // schema default is `true` and we don't want to break existing tenants.
    if (group.enableEmailBuilder === false) {
      return next(createError(403, ERROR_CODES.EMAIL_BUILDER_DISABLED));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  GUARD_EMAIL_BUILDER: guardEmailBuilder,
};
