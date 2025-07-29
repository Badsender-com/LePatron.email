const ERROR_CODES = require('../constant/error-codes');
const asyncHandler = require('express-async-handler');
const profileService = require('./profile.service');
const mailingService = require('../mailing/mailing.service');
const groupService = require('../group/group.service');
const MODE_TYPE = require('../constant/mode-type');
const { NotFound, BadRequest } = require('http-errors');

module.exports = {
  createProfile: asyncHandler(createProfile),
  updateProfile: asyncHandler(updateProfile),
  sendCampaignMail: asyncHandler(sendCampaignMail),
  deleteProfile: asyncHandler(deleteProfile),
  profileListEditor: asyncHandler(profileListEditor),
  getCampaignMail: asyncHandler(getCampaignMail),
  actitoEntitiesList: asyncHandler(actitoEntitiesList),
  actitoTargetTableList: asyncHandler(actitoTargetTablesList),
  readProfile: asyncHandler(readProfile),
  readProfileForAdmin: asyncHandler(readProfileForAdmin),
  getAdobeFolders: asyncHandler(getAdobeFolders),
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

async function createProfile(req, res) {
  const { user } = req;
  const {
    name,
    type,
    apiKey,
    secretKey,
    _company,
    ...additionalApiData
  } = req.body;
  const response = await profileService.createProfile({
    user,
    name,
    type,
    apiKey,
    secretKey,
    _company,
    additionalApiData,
  });

  res.json(response);
}

/**
 * @api {get} /profiles/get-adobe-folders : folders tree entity from Adobe email service provider
 * @apiName getAdobeFolders
 * @apiGroup Profiles
 *
 * @apiParam  {String} profileId Adobe connector profile ID
 */
async function getAdobeFolders(req, res) {
  const user = req.user;
  const { profileId } = req.query;

  if (!profileId) {
    throw new NotFound('Missing profileId');
  }

  const profile = await profileService.findOne(profileId);

  if (!profile || !profile.additionalApiData) {
    throw new NotFound('Profile not found or missing API data :', profile);
  }

  const { apiKey, secretKey, accessToken } = profile;

  if (!apiKey || !secretKey || !accessToken) {
    throw new Error(
      'Missing apiKey or secretKey or accessToken in profile data'
    );
  }

  const adobeFoldersResult = await profileService.getAdobeFolders({
    user,
    apiKey,
    secretKey,
    accessToken,
  });

  res.send({ result: adobeFoldersResult });
}

/**
 * @api {post} /profiles/:profileId profile edition
 * @apiPermission admin
 * @apiName UpdateProfile
 * @apiGroup Profiles
 *
 * @apiParam (Body) {String} name profile name.
 * @apiParam (Body) {String} type Profile type
 * @apiParam (Body) {String} apiKey the provider key
 * @apiParam (Body) {String} _company the ID of the group
 * @apiParam (Body) {String} data the data to be used with the adequat ESP provider
 *
 * @apiUse profile
 * @apiSuccess {profile} profile updated
 */

async function updateProfile(req, res) {
  const { user } = req;
  const { name, type, apiKey, _company, id, ...additionalApiData } = req.body;

  const response = await profileService.updateProfile({
    user,
    id,
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
  const {
    espSendingMailData,
    html,
    profileId,
    type,
    actionType,
    campaignId,
  } = body;

  if (actionType === MODE_TYPE.EDIT && !campaignId) {
    throw new BadRequest(ERROR_CODES.CAMPAIGN_ID_MUST_BE_DEFINED);
  }

  await mailingService.validateMailExist(mailingId);
  let response = null;

  const communEspApiFields = {
    user,
    espSendingMailData,
    profileId,
    html,
    mailingId,
    type,
  };

  if (actionType === MODE_TYPE.EDIT) {
    response = await profileService.updateEspCampaign({
      ...communEspApiFields,
      campaignId,
    });
  } else {
    response = await profileService.sendEspCampaign(communEspApiFields);
  }

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
 * @api {post} /profiles/actito-entities-list list entities from Actito email service provider
 * @apiPermission admin
 * @apiName actitoEntitiesList
 * @apiGroup Profiles
 *
 * @apiParam (Body) {String} apiKey Actito api key
 *
 */
async function actitoEntitiesList(req, res) {
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey === 'undefined') {
    throw new NotFound();
  }

  const actitoEntitiesListResult = await profileService.actitoEntitiesList({
    apiKey,
  });

  res.send({ result: actitoEntitiesListResult });
}

/**
 * @api {post} /profiles/actito-target-tables-list Target tables list from Actito email service provider
 * @apiPermission user
 * @apiName actitoTargetTablesList
 * @apiGroup Profiles
 *
 * @apiParam (Body) {String} apiKey Actito api key
 * @apiParam (Body) {String} entity Actito entity
 *
 */
async function actitoTargetTablesList(req, res) {
  const { apiKey, entity } = req.body;

  if (
    !apiKey ||
    !entity ||
    typeof apiKey === 'undefined' ||
    typeof entity === 'undefined'
  ) {
    throw new NotFound();
  }

  const actitoTargetTablesListResult = await profileService.actitoTargetTablesList(
    {
      apiKey,
      entity,
    }
  );

  res.send({ result: actitoTargetTablesListResult });
}

/**
 * @api {get} /profiles/:profileId/campaign-mail/:mailCampaignId Campaign mail report from provider
 * @apiPermission admin
 * @apiName ProfileCampaign
 * @apiGroup Profiles
 *
 * @apiParam {string} campaignMailId
 *
 */
async function getCampaignMail(req, res) {
  const { user, params } = req;
  const { campaignId, profileId } = params;

  await profileService.checkIfUserIsAuthorizedToAccessProfile({
    user,
    profileId,
  });
  const getCampaignMailData = await profileService.getCampaignMail({
    campaignId,
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

/**
 * @api {get} /profiles/:profileId/admin Get profile detail for admin
 * @apiPermission admin
 * @apiName ProfileCampaign
 * @apiGroup Profiles
 *
 * @apiParam {string} profileId
 *
 */
async function readProfileForAdmin(req, res) {
  const { user, params } = req;
  const { profileId } = params;

  if (!user.isAdmin) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }
  await profileService.checkIfUserIsAuthorizedToAccessProfile({
    user,
    profileId,
  });

  const profileResult = await profileService.findOne(profileId);

  res.send({ result: profileResult });
}
