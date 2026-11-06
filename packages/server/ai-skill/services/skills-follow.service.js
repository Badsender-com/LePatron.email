'use strict';

/**
 * A copy follows production (ADR 0019): production answers everything it
 * holds, and a copy (staging, development) applies it.
 *
 * Production's answer is the skills export (ADR 0018, format 1), extended
 * for a follow: every item, archived ones included, with its state, its
 * audience and its served-to-assistants mark, its active version and its open
 * draft. Still no history and no owner: what a copy lives is what clients
 * live, not who wrote it.
 */

const {
  FORMAT,
  identityOf,
  versionOfKind,
  everyItem,
  byId,
} = require('./skills-export.service.js');
const { findActiveVersion, openDraftOf } = require('./version-helpers.js');
const { Audiences } = require('../constant/skill-constants.js');

// An item as production answers it to a copy, or null when it holds no
// version at all: there is nothing to follow.
function itemForCopies(kind, doc) {
  const active = findActiveVersion(doc);
  const draft = openDraftOf(doc);
  if (!active && !draft) return null;
  const item = {
    ...identityOf(kind, doc),
    status: String(doc.status).toLowerCase(),
    audience: doc.audience || Audiences.PLATFORM,
  };
  if (kind === 'skill') item.servedToAssistants = !!doc.servedToAssistants;
  if (active) item.version = versionOfKind(kind, active);
  if (draft) item.draft = versionOfKind(kind, draft);
  return item;
}

const itemsForCopies = async (kind, idField) =>
  (await everyItem(kind))
    .map((doc) => itemForCopies(kind, doc))
    .filter(Boolean)
    .sort(byId(idField));

/**
 * Everything production holds, as a copy follows it: the read route's
 * answer to a read token.
 *
 * @param {Object} [context]
 * @param {string} [context.origin] the instance the export comes from
 * @param {string} [context.by] who reads it: the read token's name
 * @returns {Promise<Object>} a skills export, format 1, extended
 */
async function exportForCopies({ origin = '', by = '' } = {}) {
  return {
    format: FORMAT,
    origin,
    exportedAt: new Date().toISOString(),
    exportedBy: by,
    expertises: await itemsForCopies('expertise', 'expertiseId'),
    skills: await itemsForCopies('skill', 'skillId'),
  };
}

module.exports = { exportForCopies };
