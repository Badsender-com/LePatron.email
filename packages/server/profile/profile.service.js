const EspProvider = require('../esp/esp.service');
const { Profiles } = require('../common/models.common');
const { Types } = require('mongoose');

const ERROR_CODES = require('../constant/error-codes.js');

const { NotFound, Conflict, InternalServerError } = require('http-errors');
const mailingService = require('../mailing/mailing.service.js');

module.exports = {
  create,
  sendCampaignMail,
  findAll,
  deleteProfile,
};

async function create({ name, type, apiKey, _company, additionalApiData }) {
  const espProvider = new EspProvider({
    apiKey,
    type,
    name,
    _company,
    additionalApiData,
  });
  if (await Profiles.exists({ name, _company })) {
    throw new Conflict(ERROR_CODES.PROFILE_NAME_ALREADY_EXIST);
  }
  const espConnectionResult = await espProvider.connectApi();
  if (!espConnectionResult) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }
  return await Profiles.create({
    name,
    type,
    apiKey,
    _company,
    additionalApiData,
  });
}

async function sendCampaignMail({
  user,
  espSendingMailData,
  profileId,
  html,
  mailingId,
  type,
}) {
  const profile = await findOne(profileId);

  await checkIfMailAlreadySentToProfile({ profileId, mailingId });

  if (!profile) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }

  const {
    apiKey,
    type: profileType,
    name,
    _company,
    additionalApiData,
  } = profile;
  if (profileType !== type) {
    throw new NotFound(ERROR_CODES.INCOHERENT_PROFILE_TYPES);
  }
  const espProvider = new EspProvider({
    apiKey,
    type,
    name,
    _company,
    additionalApiData,
  });

  const espMailCampaignId = await espProvider.createCampaignMail({
    espSendingMailData,
    user,
    html,
    mailingId,
  });

  await mailingService.updateMailEspIds(profileId, {
    profileId,
    mailCampaignId: espMailCampaignId,
  });

  return {
    profileId,
    mailCampaignId: espMailCampaignId,
  };
}

async function findOne(profileId) {
  if (!(await Profiles.exists({ _id: Types.ObjectId(profileId) }))) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }
  return Profiles.findOne({ _id: Types.ObjectId(profileId) });
}

// Check if we have already sent mail to profile
async function checkIfMailAlreadySentToProfile({ profileId, mailingId }) {
  const mailing = await mailingService.findOne(mailingId);

  if (mailing.espIds?.length === 0) {
    return true;
  }

  mailing.espIds.forEach((espId) => {
    if (espId?.id === profileId) {
      throw new Conflict(ERROR_CODES.MAIL_ALREADY_SENT_TO_PROFILE);
    }
  });

  return true;
}

async function findAll() {
  return Profiles.find({}).sort({ name: 1 });
}

async function deleteProfile({ profileId }) {
  const profile = await findOne(profileId);

  const deleteProfileResponse = deleteOne(profile.id);

  if (deleteProfileResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_PROFILE_DELETE);
  }

  return deleteProfileResponse;
}

async function deleteOne(profileId) {
  return Profiles.deleteOne({ _id: Types.ObjectId(profileId) });
}
