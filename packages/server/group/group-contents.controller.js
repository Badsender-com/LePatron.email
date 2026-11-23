'use strict';

// What a company holds, listed for its settings: users, templates, emails
// groups, profiles, mailings, workspaces, and its color scheme.

const { NotFound } = require('http-errors');
const asyncHandler = require('express-async-handler');
const { findWorkspaces } = require('../workspace/workspace.service.js');

const groupService = require('../group/group.service.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const profileService = require('../profile/profile.service.js');
const emailsGroupService = require('../emails-group/emails-group.service.js');
const {
  MAILING_LIST_PROJECTION,
} = require('../constant/mailing-list-projection.js');
const { Groups, Templates, Mailings } = require('../common/models.common.js');

module.exports = {
  readUsers: asyncHandler(readUsers),
  readTemplates: asyncHandler(readTemplates),
  readMailings: asyncHandler(readMailings),
  readProfiles: asyncHandler(readProfiles),
  readWorkspaces: asyncHandler(readWorkspaces),
  readEmailGroups: asyncHandler(readEmailGroups),
  readColorScheme: asyncHandler(readColorScheme),
};

/**
 * @api {get} /groups/:groupId/users group users
 * @apiPermission admin
 * @apiName GetGroupUsers
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse users
 * @apiSuccess {users[]} items list of users
 */

async function readUsers(req, res) {
  const {
    params: { groupId },
  } = req;

  const users = await groupService.findUserByGroupId(groupId);
  // Who uses which verification method is for the admins (ADR 0008).
  if (!permissions.can(req.user, CAPABILITIES.GROUP_MANAGE)) {
    const items = users.map((user) => {
      const visible = user.toJSON();
      delete visible.twoFactorMethod;
      return visible;
    });
    return res.json({ items });
  }
  res.json({ items: users });
}

/**
 * @api {get} /groups/:groupId/templates group templates
 * @apiPermission admin
 * @apiName GetGroupTemplates
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse templates
 * @apiSuccess {templates[]} items list of templates
 */

async function readTemplates(req, res) {
  const { groupId } = req.params;
  const [group, templates] = await Promise.all([
    Groups.findById(groupId).select('_id'),
    Templates.findForApi({ _company: groupId }),
  ]);
  if (!group) throw new NotFound();
  res.json({ items: templates });
}

/**
 * @api {get} /groups/:groupId/email-groups group emails
 * @apiPermission group_admin
 * @apiName GetEmailGroups
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse emailsGroup
 * @apiSuccess {emailGroup[]} items list of email groups
 */

async function readEmailGroups(req, res) {
  const { groupId } = req.params;
  const emailGroups = await emailsGroupService.listEmailsGroups(groupId);
  if (!emailGroups) throw new NotFound();
  res.json({ items: emailGroups });
}

/**
 * @api {GET}  /groups/:groupId/profiles group profiles
 * @apiPermission admin
 * @apiName profilesList
 * @apiGroup Profiles
 *
 * @apiUse profile
 */

async function readProfiles(req, res) {
  const { groupId } = req.params;

  await groupService.findById(groupId);

  const profiles = await profileService.findAllByGroup({ groupId });
  res.json({ items: profiles });
}

/**
 * @api {get} /groups/:groupId/mailings group mailings
 * @apiPermission admin
 * @apiName GetGroupMailings
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items list of mailings
 */

async function readMailings(req, res) {
  const { groupId } = req.params;
  const {
    page: pageParam = 1,
    limit: limitParam = 10,
    sortBy: sortByParam,
    sortDesc: sortDescParam,
  } = req.query;
  const page = parseInt(pageParam);
  let limit = parseInt(limitParam);

  let skip = (page - 1) * limit; // Calculate the number of items to skip
  if (limit === -1) {
    limit = 0;
    skip = 0;
  }
  const group = await Groups.findById(groupId).select('_id');
  if (!group) {
    throw new NotFound();
  }

  // Build the sort from the table headers. `templateName`/`userName` are only
  // exposed via projection aliases, so map them to the stored fields the same
  // way mailing.schema.js findForApiWithPagination does. Default: most recently
  // updated first.
  const SORT_FIELD_MAP = {
    templateName: 'wireframe',
    userName: 'author',
  };
  let sort = { updatedAt: -1 };
  if (sortByParam) {
    const sortKey = SORT_FIELD_MAP[sortByParam] || sortByParam;
    const direction =
      sortDescParam === 'true' || sortDescParam === true ? -1 : 1;
    sort = { [sortKey]: direction };
  }

  // Retrieve mailings excluding the heavy fields the table never shows, and
  // their total count
  const [mailings, totalItems] = await Promise.all([
    Mailings.find({ _company: groupId })
      .select(MAILING_LIST_PROJECTION)
      .sort(sort)
      // in case limit = -1, we want to retrieve all mailings
      .skip(skip)
      .limit(limit),
    Mailings.countDocuments({ _company: groupId }), // Count all mailings for this group
  ]);

  res.json({
    items: mailings,
    totalItems,
    currentPage: page,
    totalPages: Math.ceil(totalItems / limit), // Calculate the total number of pages
  });
}

/**
 * @api {get} /groups/:groupId/workspaces group workspaces
 * @apiPermission admin
 * @apiName GetGroupWorkspaces
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse workspace
 * @apiSuccess {workspaces[]} items list of workspaces
 */

async function readWorkspaces(req, res, next) {
  const { groupId } = req.params;
  if (!groupId) next(new NotFound());
  const workspaces = await findWorkspaces({ groupId });
  return res.json({ items: workspaces });
}

/**
 * @api {get} /groups/:groupId/color-scheme get group color scheme
 * @apiPermission user
 * @apiName GetGroupColorScheme
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse workspace
 * @apiSuccess {colorScheme} group color scheme
 */
async function readColorScheme(req, res) {
  const {
    params: { groupId },
    user,
  } = req;
  if (!groupId) throw new NotFound();

  if (!permissions.canAccessGroup(user, groupId)) {
    throw new NotFound();
  }

  const colorScheme = await groupService.findColorScheme({ groupId });
  return res.json({ items: colorScheme });
}
