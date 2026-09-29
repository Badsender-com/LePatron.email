'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const mongoose = require('mongoose');

const config = require('../node.config.js');
const ERROR_CODES = require('../constant/error-codes.js');
const mailingService = require('../mailing/mailing.service.js');
const shareLinkService = require('./share-link.service.js');

// The editor's side of preview links (/api/mailings/:mailingId/share-links).
// The public page they open is share-page.controller.js.

module.exports = {
  create: asyncHandler(create),
  list: asyncHandler(list),
  revoke: asyncHandler(revoke),
};

// Sharing an email outside the company takes the right to edit it.
async function editableMailing(req) {
  const mailing = await mailingService.findOneForUser(
    req.params.mailingId,
    req.user
  );
  await mailingService.assertUserCanEditMailing(req.user, mailing);
  return mailing;
}

// The platform's own address. The Host header only in development, where
// several servers run side by side: elsewhere a platform reachable under
// several names must not hand out links on the wrong one.
function shareUrl(req, token) {
  if (config.isDev) {
    return `${req.protocol}://${req.get('host')}/share/${token}`;
  }
  return `https://${config.host}/share/${token}`;
}

/**
 * @api {post} /mailings/:mailingId/share-links create a preview link
 * @apiPermission user
 * @apiName CreateMailingShareLink
 * @apiGroup Mailings
 *
 * @apiParam (Body) {Number} [expiresInDays=7] 1, 7 or 30
 * @apiSuccess {String} id
 * @apiSuccess {String} url the link
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} expiresAt
 * @apiSuccess {String} createdBy
 */
async function create(req, res) {
  // A form on another site can post urlencoded data with the session cookie;
  // JSON takes a preflight it would not pass.
  if (!req.is('application/json')) {
    throw new createError.UnsupportedMediaType(ERROR_CODES.INVALID_SHARE_LINK);
  }
  const { expiresInDays } = shareLinkService.validateCreatePayload(req.body);
  const mailing = await editableMailing(req);
  const { link, token } = await shareLinkService.createShareLink({
    mailing,
    user: req.user,
    expiresInDays,
  });
  res.status(201).json({
    ...shareLinkService.toApi(link),
    // As the list will show it: the admin's links have no author.
    createdBy: link._user ? req.user.name || null : null,
    url: shareUrl(req, token),
    // Whether the list will offer to copy it again.
    copyable: Boolean(link.tokenEncrypted),
  });
}

/**
 * @api {get} /mailings/:mailingId/share-links list the active preview links
 * @apiPermission user
 * @apiName ListMailingShareLinks
 * @apiGroup Mailings
 * @apiSuccess {Object[]} items `{ id, createdAt, expiresAt, createdBy, url }`,
 *   `url` null for a link that cannot be shown again
 */
async function list(req, res) {
  const mailing = await editableMailing(req);
  // Working links: never cached on the way.
  res.set('Cache-Control', 'private, no-store');
  res.json({
    items: await shareLinkService.listActiveLinks(mailing._id, (token) =>
      shareUrl(req, token)
    ),
  });
}

/**
 * @api {delete} /mailings/:mailingId/share-links/:linkId revoke a preview link
 * @apiPermission user
 * @apiName RevokeMailingShareLink
 * @apiGroup Mailings
 */
async function revoke(req, res) {
  const { linkId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(linkId)) {
    throw new createError.NotFound(ERROR_CODES.SHARE_LINK_NOT_FOUND);
  }
  const mailing = await editableMailing(req);
  await shareLinkService.revokeLink(mailing._id, linkId);
  res.status(204).end();
}
