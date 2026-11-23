'use strict';

// The company itself: its list, its reading, the platform flag, its deletion
// and the test of its FTP. Its creation and update are in
// group-write.controller.js, what it holds in group-contents.controller.js,
// its personalized variables in group-personalized-variables.controller.js;
// all of them are exported from here, for the routes.

const { NotFound } = require('http-errors');
const asyncHandler = require('express-async-handler');

const groupService = require('../group/group.service.js');
const superAdminPolicy = require('../user/super-admin-policy.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const groupFtpService = require('../group/group-ftp.service.js');
const { Groups, Profiles } = require('../common/models.common.js');
const groupWrite = require('./group-write.controller.js');
const groupContents = require('./group-contents.controller.js');
const groupPersonalizedVariables = require('./group-personalized-variables.controller.js');

module.exports = {
  list: asyncHandler(list),
  seedGroups: asyncHandler(seedGroups),
  read: asyncHandler(read),
  setPlatform: asyncHandler(setPlatform),
  deleteGroup: asyncHandler(deleteGroup),
  testFtpConnection: asyncHandler(testFtpConnection),
  ...groupWrite,
  ...groupContents,
  ...groupPersonalizedVariables,
};

/**
 * @api {get} /groups list of groups
 * @apiPermission admin
 * @apiName GetGroups
 * @apiGroup Groups
 *
 * @apiUse group
 * @apiSuccess {group[]} items list of groups
 */

async function list(req, res) {
  // The platform group is a real operator group (Badsender / self-host
  // operator) used for actual emailing, so it appears in listings like any
  // other group — no filtering.
  const [groups, groupsWithProfiles] = await Promise.all([
    Groups.find({}).sort({ name: 1 }),
    Profiles.distinct('_company'),
  ]);
  const profileGroupSet = new Set(groupsWithProfiles.map(String));
  const items = groups.map((group) => ({
    ...group.toJSON(),
    hasProfiles: profileGroupSet.has(String(group._id)),
  }));
  res.json({ items });
}

/**
 * @api {put} /groups/:groupId/platform Set or unset the platform group
 * @apiPermission admin
 * @apiName SetPlatformGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 * @apiParam (Body) {Boolean} [isPlatform=true] Whether this group becomes the
 *   platform group. Setting it true moves the flag: any other platform group is
 *   unset first (the platform group is a singleton, also enforced by a partial
 *   unique index).
 */
async function setPlatform(req, res) {
  const { groupId } = req.params;
  const isPlatform = req.body.isPlatform !== false; // default true

  const group = await Groups.findById(groupId);
  if (!group) {
    throw new NotFound();
  }

  if (!isPlatform) {
    // The flag cannot leave a group with active super admins (ADR 0002).
    await superAdminPolicy.assertFlagCanLeave(group);
    await Groups.updateOne({ _id: group._id }, { $set: { isPlatform: false } });
    group.isPlatform = false;
    return res.json(group.toJSON());
  }

  // Move the flag: the current platform group gives it up first, so the
  // partial unique index never trips, then this one takes it. Moved by the
  // bootstrap account, the flag takes the super admins along (ADR 0002).
  const current = await Groups.findOne({
    isPlatform: true,
    _id: { $ne: group._id },
  });
  if (current) {
    await superAdminPolicy.assertFlagCanLeave(current, {
      actor: req.user,
      destination: group,
    });
    // Only the flag changes: no validation of the rest of the document.
    await Groups.updateOne(
      { _id: current._id },
      { $set: { isPlatform: false } }
    );
  }
  group.isPlatform = true;
  await group.save();
  // Every super admin of the group, deactivated ones included, follows the
  // flag, so that a reactivation still finds them in the platform group.
  if (current) {
    await superAdminPolicy.moveSuperAdmins(req.user, current, group);
  }
  res.json(group.toJSON());
}

/**
 * @api {post} /seed-groups update groups that have no workspace
 * @apiPermission super_admin
 * @apiName UpdateGroupsWithNoWorkspaces
 * @apiGroup Groups
 *
 * @apiUse group
 */

async function seedGroups(req, res) {
  const seededGroups = await groupService.seedGroups();

  res.json({ groups: seededGroups.map((group) => group.name) });
}

/**
 * @api {get} /groups/:groupId group
 * @apiPermission admin
 * @apiName GetGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse group
 */

async function read(req, res) {
  const { groupId } = req.params;
  const group = await Groups.findById(groupId);
  if (!group) throw new NotFound();
  res.json(groupFtpService.maskFtpCredentials(group));
}

/**
 * @api {get} /groups/:groupId detele group
 * @apiPermission admin
 * @apiName GetGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse group
 */

async function deleteGroup(req, res) {
  const {
    params: { groupId },
    user,
  } = req;
  const group = await Groups.findById(groupId);
  if (!group) throw new NotFound();

  if (!permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) {
    throw new NotFound();
  }
  // Deleting the group would delete its super admins with it (ADR 0002).
  await superAdminPolicy.assertFlagCanLeave(group);
  await groupService.deleteGroup(groupId);

  res.json(group);
}

/**
 * @api {post} /groups/:groupId/test-ftp-connection Test FTP connection
 * @apiPermission admin
 * @apiName TestFtpConnection
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiSuccess {Boolean} success connection result
 * @apiSuccess {String} message result message
 */
async function testFtpConnection(req, res) {
  const { groupId } = req.params;
  const group = await Groups.findById(groupId);

  if (!group) {
    throw new NotFound();
  }

  // Allow overriding FTP settings from the form (to test before saving)
  const ftpOverrides = [
    'downloadMailingWithFtpImages',
    'ftpAuthType',
    'ftpHost',
    'ftpPort',
    'ftpUsername',
    'ftpProtocol',
    'ftpPathOnServer',
    'ftpSshKey',
    'ftpPassword',
  ];
  for (const field of ftpOverrides) {
    if (req.body[field] !== undefined) {
      group[field] = req.body[field];
    }
  }

  const result = await groupFtpService.testConnection(group);
  return res.json(result);
}
