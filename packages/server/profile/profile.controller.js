const asyncHandler = require('express-async-handler');
const profileService = require('./profile.service');
const mailingService = require('../mailing/mailing.service');
const groupService = require('../group/group.service');

module.exports = {
  create: asyncHandler(create),
  sendCampaignMail: asyncHandler(sendCampaignMail),
  deleteProfile: asyncHandler(deleteProfile),
  profileListEditor: asyncHandler(profileListEditor),
  getCampaignMail: asyncHandler(getCampaignMail),
  readProfile: asyncHandler(readProfile),
};

/**
 * @api {post} /profiles profile creation
 * @apiPermission admin
 * @apiName CreateProfile
 * @apiGroup Profiles
 *
 * @apiParam (Body) {String} name profile name.
 * @apiParam (Body) {String} type Profile type
 * @apiParam (Body) {String} apiKey the provider key
 * @apiParam (Body) {String} _company the ID of the group
 * @apiParam (Body) {String} data the data to be used with the adequat ESP provider
 *
 * @apiUse profile
 */

async function create(req, res) {
  const { user } = req;
  const { name, type, apiKey, _company, ...additionalApiData } = req.body;

  const response = await profileService.create({
    user,
    name,
    type,
    apiKey,
    _company,
    additionalApiData,
  });

  res.json(response);
}

/**
 * @api {post} /profiles/send-campaign-mail send campaign mail to ESP
 * @apiPermission admin
 * @apiName sendCampaignMail
 * @apiGroup Profiles
 *
 * @apiParam (Body) {String} espRequestData esp data that will be sent.
 * @apiParam (Body) {String} type Profile type
 * @apiParam (Body) {String} _company the ID of the group
 * @apiParam (Body) {String} profileId the id of the profile that we will import
 *
 * @apiUse profile
 */

async function sendCampaignMail(req, res) {
  const { user, body } = req;
  const { mailingId } = req.params;
  const { espSendingMailData, html, profileId, type, _company } = body;

  await mailingService.validateMailExist(mailingId);

  const response = await profileService.sendCampaignMail({
    user,
    espSendingMailData,
    profileId,
    html,
    mailingId,
    type,
    _company,
  });

  res.json(response);
}

/**
 * @api {del} /profiles/:profileId profile delete
 * @apiPermission admin
 * @apiName ProfileDelete
 * @apiGroup Profiles
 *
 * @apiParam {string} profileId
 *
 */
async function deleteProfile(req, res) {
  const { profileId } = req.params;

  const deleteProfileResponse = await profileService.deleteProfile({
    profileId,
  });

  res.send({ result: deleteProfileResponse });
}

/**
 * @api {get} /profiles/:groupId/profile-list-for-editor list profiles for editor for a group id
 * @apiPermission user
 * @apiName ProfileListEditor
 * @apiGroup Profiles
 *
 * @apiParam {string} groupId
 *
 */
async function profileListEditor(req, res) {
  const { user, params } = req;
  const { groupId } = params;

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  const profileListEditorResult = await profileService.profileListEditor({
    groupId,
  });

  res.send({ result: profileListEditorResult });
}

/**
 * @api {get} /profiles/:profileId/campaign-mail/:mailCampaignId Campaign mail report from provider
 * @apiPermission user
 * @apiName ProfileCampaign
 * @apiGroup Profiles
 *
 * @apiParam {string} campaignMailId
 *
 */
async function getCampaignMail(req, res) {
  const { user, params } = req;
  const { campaignMailId, profileId } = params;

  await profileService.checkIfUserIsAuthorizedToAccessProfile({
    user,
    profileId,
  });
  const getCampaignMailData = await profileService.getCampaignMail({
    campaignMailId,
    profileId,
  });

  res.send({ result: getCampaignMailData });
}

/**
 * @api {get} /profiles/:profileId Get profile detail
 * @apiPermission user
 * @apiName ProfileCampaign
 * @apiGroup Profiles
 *
 * @apiParam {string} profileId
 *
 */
async function readProfile(req, res) {
  const { user, params } = req;
  const { profileId } = params;

  await profileService.checkIfUserIsAuthorizedToAccessProfile({
    user,
    profileId,
  });

  const getProfileResult = await profileService.findOneWithoutApiKey({
    profileId,
  });

  res.send({ result: getProfileResult });
}
