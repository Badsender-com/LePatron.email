'use strict';

const { Audiences } = require('../constant/skill-constants.js');

/**
 * Who uses a skill or an expertise (ADR 0013), the one rule for every path
 * that serves one: the editor's features, the invocation of a feature skill on
 * behalf of a user, and the MCP server. The platform company uses every
 * audience; any other company, or a caller whose company is unknown, only what
 * is explicitly opened to all. One with no audience is not opened: it waits
 * for `scripts/migrate-audience-all.js`.
 */

// A reader that uses every audience, as the platform company does: the super
// admins' playground, which tries what is not opened yet.
const PLATFORM_READER = Object.freeze({ isPlatform: true });

function readsEveryAudience(group) {
  return Boolean(group) && group.isPlatform === true;
}

/**
 * @param {Object} [group] the company of the caller, as its document stores it
 * @returns {Object} a filter to add to a query on skills or expertises
 */
function audienceFilter(group) {
  return readsEveryAudience(group) ? {} : { audience: Audiences.ALL };
}

/**
 * @param {Object} doc a skill or an expertise
 * @param {Object} [group] the company of the caller
 * @returns {boolean} whether that company may use it
 */
function isAvailableTo(doc, group) {
  if (!doc) return false;
  return readsEveryAudience(group) || doc.audience === Audiences.ALL;
}

/**
 * The default audience, set on a new document only. A plain default would
 * also be set on an older document as it loads, and written at its next save:
 * one the migration has not reached yet would silently close to the clients.
 * Called by Mongoose with the document as `this`.
 */
function newItemAudience() {
  return this.isNew ? Audiences.PLATFORM : undefined;
}

module.exports = {
  PLATFORM_READER,
  audienceFilter,
  isAvailableTo,
  newItemAudience,
};
