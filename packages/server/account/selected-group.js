'use strict';

const { Groups } = require('../common/models.common.js');
const { isObjectIdString } = require('../utils/model.js');
const { isBootstrapAccount } = require('./bootstrap-account.js');

// The selected group (ADR 0002, amended): the group a super admin works in,
// shared by the modules and the settings. A super admin stores it on its
// account; the bootstrap account, which has no stored account, keeps it in its
// session; anyone else's selected group is their own group.

function summaryOf(group) {
  return group ? { id: String(group._id), name: group.name } : null;
}

async function findGroupSummary(groupId) {
  const id = groupId && String(groupId);
  if (!isObjectIdString(id)) return null;
  return summaryOf(await Groups.findById(groupId).select('name').lean());
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
      ? { id: String(user.group.id), name: user.group.name }
      : null;
  }

  const stored = await findGroupSummary(user._selectedGroup);
  if (stored) return stored;

  const platform = await Groups.findOne({ isPlatform: true })
    .select('name')
    .lean();
  if (platform) return summaryOf(platform);

  return summaryOf(
    await Groups.findOne({}).sort({ name: 1 }).select('name').lean()
  );
}

/**
 * Puts the resolved selected group on the request's user, so the scope of a
 * module request, the module guards and the first server-rendered page read
 * one value.
 */
async function attachSelectedGroup(req, res, next) {
  try {
    if (req.user) {
      req.user = {
        ...req.user,
        selectedGroup: await resolveSelectedGroup(req.user, req.session),
      };
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  resolveSelectedGroup,
  findGroupSummary,
  attachSelectedGroup,
};
