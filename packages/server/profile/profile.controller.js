const asyncHandler = require('express-async-handler');
const profileService = require('./profile.service');
module.exports = {
  create: asyncHandler(create),
  sendCampaignMail: asyncHandler(sendCampaignMail),
};

/**
 * @api {post} /profiles profile creation
 * @apiPermission group_admin
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
  console.log('create profile log');
  const { user } = req;
  const { name, type, apiKey, _company, additionalApiData } = req.body;

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
 * @api {post} /profiles send campaign mail to ESP
 * @apiPermission group_admin
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
  const { user } = req;
  const { espRequestData, profileId, type, _company } = req.body;

  const response = await profileService.sendCampaignMail({
    user,
    espRequestData,
    profileId,
    type,
    _company,
  });

  res.json(response);
}
