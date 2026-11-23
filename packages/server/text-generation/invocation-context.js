'use strict';

const createError = require('http-errors');

const expertiseRepo = require('../ai-skill/repositories/expertise.repository.js');
const mailingService = require('../mailing/mailing.service.js');
const mailingMetadataService = require('../mailing/mailing-metadata.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { Templates } = require('../common/models.common.js');
const { resourceGroupIdOf } = require('../account/request-scope.js');
const manifest = require('./skill-manifest.js');

// What every invocation of text generation starts from (ADR 0016): the
// mailing the user may edit, the group of the request, the email type and the
// expertises of a scope.

// The expertise each invocation reads, as the manifest declares it: one
// declaration for this code, `yarn check-skills` and the activation alert.
function expertiseCategories(scope) {
  const filter = manifest.expertiseFilters.find((f) => f.scope.includes(scope));
  return filter.categories;
}

// Undefined fields are left out, so the skill never reads an empty tag as data.
const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );

/**
 * The group of the request is the email's (ADR 0002), whoever asks: its engine
 * serves the request, its audience decides which skills and expertises apply,
 * its settings decide what is logged. A super admin's own group is the
 * platform's, never the one of the email it opens. A mailing created before
 * companies were stamped on mailings takes the company of its template, the
 * group the editor shows the button for.
 */
async function requestGroupId(user, mailing) {
  let groupId = mailing._company;
  if (!groupId) {
    const template = await Templates.findById(mailing._wireframe)
      .select({ _company: 1 })
      .lean();
    groupId = template?._company;
  }
  if (!groupId) throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  return resourceGroupIdOf(user, groupId);
}

// What the generation reads of the mailing: its group, its type, and where it
// lives for the right to edit it. Never its content: the editor sends the text
// it shows.
const MAILING_PROJECTION = {
  _company: 1,
  _wireframe: 1,
  _emailType: 1,
  _workspace: 1,
  _parentFolder: 1,
};

/**
 * What every invocation of this feature starts from: access to the mailing, its
 * group, its email type, and the expertises of the scope that group may read.
 */
async function prepare({ user, mailingId, scope }) {
  const mailing = await mailingService.findOneForUser(
    mailingId,
    user,
    MAILING_PROJECTION
  );
  await mailingService.assertUserCanEditMailing(user, mailing);
  const groupId = await requestGroupId(user, mailing);

  const emailType = await mailingMetadataService.findCanonicalEmailType(
    mailing
  );
  const expertise = await expertiseRepo.findApplicable(
    compact({
      scope,
      categories: expertiseCategories(scope),
      emailType: emailType || undefined,
      groupId,
    })
  );

  return { groupId, emailType: emailType || undefined, expertise };
}

module.exports = { prepare, compact };
