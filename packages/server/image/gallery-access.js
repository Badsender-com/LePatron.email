'use strict';

const createError = require('http-errors');

const { Mailings, Templates } = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const mailingService = require('../mailing/mailing.service.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  assertCanReadGallery,
  assertCanWriteGallery,
  assertCanEditGallery,
};

// A gallery carries no company of its own: it belongs to the mailing or the
// template whose id it bears (creationOrWireframeId), and reaching it is
// reaching that parent, found in the user's company (any for a super admin):
// - the gallery of an email is read by whoever may read the email, and
//   written (uploads, deletions, labels) by whoever may save it: its
//   workspace, or the workspace of its folder;
// - the gallery of a template is read and written by the users of the
//   template's company, as the editor offers it with any email built on it;
//   its labels follow the rule for editing a template (PUT /templates/:id):
//   platform.manage.
//
// Every refusal is the same Forbidden, a missing parent included, so the
// answer says nothing about what exists in another group or workspace.
async function galleryParentOf(user, creationOrWireframeId) {
  const query = modelsUtils.addGroupFilter(user, {
    _id: creationOrWireframeId,
  });
  const [mailing, template] = await Promise.all([
    Mailings.findOne(query, '_id _workspace _parentFolder'),
    Templates.findOne(query, '_id'),
  ]);
  return { mailing, template };
}

async function assertGalleryRule(user, creationOrWireframeId, rule) {
  const { mailing, template } = await galleryParentOf(
    user,
    creationOrWireframeId
  );
  const allowed = mailing
    ? await rule.mailing(user, mailing)
    : !!template && rule.template(user);
  if (!allowed) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_GALLERY_ACCESS);
  }
}

const anyUserOfItsCompany = () => true;

function assertCanReadGallery(user, creationOrWireframeId) {
  return assertGalleryRule(user, creationOrWireframeId, {
    mailing: mailingService.userCanReadMailing,
    template: anyUserOfItsCompany,
  });
}

function assertCanWriteGallery(user, creationOrWireframeId) {
  return assertGalleryRule(user, creationOrWireframeId, {
    mailing: mailingService.userCanEditMailing,
    template: anyUserOfItsCompany,
  });
}

function assertCanEditGallery(user, creationOrWireframeId) {
  return assertGalleryRule(user, creationOrWireframeId, {
    mailing: mailingService.userCanEditMailing,
    template: (actor) => permissions.can(actor, CAPABILITIES.PLATFORM_MANAGE),
  });
}
