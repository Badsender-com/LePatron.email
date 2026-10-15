'use strict';

const { Groups, Users } = require('../common/models.common.js');
const logger = require('../utils/logger.js');
const { isObjectIdString } = require('../utils/model.js');
const { isBootstrapAccount } = require('./bootstrap-account.js');

// The selected group (ADR 0002, amended): the group a super admin works in,
// shared by the modules and the settings. A super admin stores it on its
// account; the bootstrap account, which has no stored account, keeps it in its
// session; anyone else's selected group is their own group.

// What the UI needs of the selected group: its name, the module flags the
// sidebar locks the modules on, and the export options of the module screens.
const SUMMARY_FIELDS =
  'name enableEmailBuilder enableCrmIntelligence downloadMailingWithFtpImages';

function summaryOf(group) {
  return group
    ? {
        id: String(group._id),
        name: group.name,
        enableEmailBuilder: group.enableEmailBuilder,
        enableCrmIntelligence: group.enableCrmIntelligence,
        downloadMailingWithFtpImages: group.downloadMailingWithFtpImages,
      }
    : null;
}

async function findGroupSummary(groupId) {
  const id = groupId && String(groupId);
  if (!isObjectIdString(id)) return null;
  return summaryOf(
    await Groups.findById(groupId).select(SUMMARY_FIELDS).lean()
  );
}

/**
 * The selected group of a user, with its fallbacks: for a super admin, the
 * stored group, else the platform group, else the first group by name; for
 * the bootstrap account, the group chosen in its session, with no fallback,
 * since it stays in the settings; for anyone else, their own group.
 *
 * @param {Object} user the request user
 * @param {Object} [session] the request session
 * @returns {Promise<{ id: string, name: string } | null>}
 */
async function resolveSelectedGroup(user, session) {
  if (!user) return null;

  if (isBootstrapAccount(user)) {
    return findGroupSummary(session && session.selectedGroupId);
  }

  if (!user.isAdmin) {
    return user.group
      ? summaryOf({ ...user.group, _id: user.group.id || user.group._id })
      : null;
  }

  const stored = await findGroupSummary(user._selectedGroup);
  if (stored) return stored;
  if (user._selectedGroup) {
    // The stored group is gone: forget it, so the fallbacks below are not
    // searched again on every request.
    await Users.updateOne({ _id: user.id }, { $unset: { _selectedGroup: 1 } });
  }

  const platform = await Groups.findOne({ isPlatform: true })
    .select(SUMMARY_FIELDS)
    .lean();
  if (platform) return summaryOf(platform);

  return summaryOf(
    await Groups.findOne({}).sort({ name: 1 }).select(SUMMARY_FIELDS).lean()
  );
}

/**
 * Puts the resolved selected group on the request's user, so the scope of a
 * module request, the module guards and the first server-rendered page read
 * one value.
 */
async function attachSelectedGroup(req, res, next) {
  // The bundles and static files need no user.
  if (!req.user || req.path.startsWith('/_nuxt/')) return next();
  let selectedGroup = null;
  try {
    selectedGroup = await resolveSelectedGroup(req.user, req.session);
  } catch (error) {
    // Like the session validation: log, and let the request go on without a
    // selected group rather than fail every request of a super admin.
    logger.error('[selected group] resolution failed:', error);
  }
  req.user = { ...req.user, selectedGroup };
  return next();
}

/**
 * Selects a group for a super admin (stored on its account) or the bootstrap
 * account (kept in its session). Anyone else's selected group is their own.
 *
 * @param {Object} req the request, its user and session
 * @param {string} groupId
 * @returns {Promise<Object|null>} the selected group, or null when unknown
 */
async function selectGroup(req, groupId) {
  const selectedGroup = await findGroupSummary(groupId);
  if (!selectedGroup || !req.user || !req.user.isAdmin) return selectedGroup;
  if (isBootstrapAccount(req.user)) {
    req.session.selectedGroupId = selectedGroup.id;
  } else {
    await Users.updateOne(
      { _id: req.user.id },
      { _selectedGroup: selectedGroup.id }
    );
  }
  return selectedGroup;
}

/**
 * The bootstrap account's choice lives in the session, which a sign-out or a
 * new sign-in keeps: both forget it.
 */
function forgetSessionSelection(req) {
  if (req.session) delete req.session.selectedGroupId;
}

module.exports = {
  resolveSelectedGroup,
  findGroupSummary,
  attachSelectedGroup,
  selectGroup,
  forgetSessionSelection,
};
