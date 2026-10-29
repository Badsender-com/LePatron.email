'use strict';

const mongoose = require('mongoose');
const { Mailings, Workspaces, Folders } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');

// Folders nest; the workspace is the first one up the chain that names one.
async function workspaceOf(mailing) {
  if (mailing._workspace) {
    return Workspaces.findById(mailing._workspace).lean();
  }
  let folderId = mailing._parentFolder;
  for (let depth = 0; folderId && depth < 20; depth += 1) {
    // eslint-disable-next-line no-await-in-loop
    const folder = await Folders.findById(folderId).lean();
    if (!folder) return null;
    if (folder._workspace) return Workspaces.findById(folder._workspace).lean();
    folderId = folder._parentFolder;
  }
  return null;
}

/**
 * A mailing the user may read, in the group the token is bound to, or null
 * (ADR 0012): the read rule of the app (`canReadWorkspace`), and never another
 * group, even for a super admin, who reads every workspace in the app.
 *
 * @param {string} mailingId
 * @param {{ user: Object, group: Object }} identity from resolveIdentity
 * @returns {Promise<Object|null>} the mailing, lean
 */
async function readableMailing(mailingId, { user, group }) {
  if (!mongoose.Types.ObjectId.isValid(String(mailingId))) return null;
  const mailing = await Mailings.findOne({
    _id: String(mailingId),
    _company: String(group._id),
  }).lean();
  if (!mailing) return null;
  const workspace = await workspaceOf(mailing);
  if (!workspace) return null;
  return permissions.canReadWorkspace(user, workspace, group) ? mailing : null;
}

module.exports = { readableMailing };
