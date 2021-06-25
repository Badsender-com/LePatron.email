const EspProvider = require('../esp/esp.service');
const { Profiles } = require('../common/models.common');
const { Types } = require('mongoose');

const ERROR_CODES = require('../constant/error-codes.js');

const {
  NotFound,
  Conflict,
  InternalServerError,
  Unauthorized,
} = require('http-errors');
const mailingService = require('../mailing/mailing.service.js');
const groupService = require('../group/group.service.js');

module.exports = {
  create,
  sendCampaignMail,
  findAllByGroup,
  deleteProfile,
  findOne,
  profileListEditor,
  getCampaignMail,
  getProfile,
  findOneWithoutApiKey,
  checkIfUserIsAuthorizedToAccessProfile,
};

async function checkIfUserIsAuthorizedToAccessProfile({ user, profileId }) {
  const profile = await findOne(profileId);
  if (!user.isAdmin) {
    if (user?.group.id !== profile?._company?.toString()) {
      throw new Unauthorized(ERROR_CODES.FORBIDDEN_PROFILE_ACCESS);
    }
  }
}

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
  await checkIfProfileExiste(profileId);
  return Profiles.findOne({ _id: Types.ObjectId(profileId) });
}

async function findOneWithoutApiKey({ profileId }) {
  await checkIfProfileExiste(profileId);
  return Profiles.findOne({ _id: Types.ObjectId(profileId) }, { apiKey: 0 });
}

async function checkIfProfileExiste(profileId) {
  if (!(await Profiles.exists({ _id: Types.ObjectId(profileId) }))) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }
}

// Check if we have already sent mail to profile
async function checkIfMailAlreadySentToProfile({ profileId, mailingId }) {
  const mailing = await mailingService.findOne(mailingId);

  if (mailing.espIds?.length === 0) {
    return true;
  }

  mailing.espIds.forEach((espId) => {
    if (espId?.profileId?.toString() === profileId?.toString()) {
      throw new Conflict(ERROR_CODES.MAIL_ALREADY_SENT_TO_PROFILE);
    }
  });

  return true;
}

async function findAllByGroup({ groupId }) {
  await groupService.findById(groupId);

  return Profiles.find({ _company: groupId }).sort({ name: 1 });
}

async function deleteProfile({ profileId }) {
  const profile = await findOne(profileId);

  const deleteProfileResponse = await deleteOne(profile.id);

  if (deleteProfileResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_PROFILE_DELETE);
  }

  return deleteProfileResponse;
}

async function profileListEditor({ groupId }) {
  // Check if group id exist else throw exception
  await groupService.findById(groupId);

  return Profiles.find(
    {
      _company: groupId,
    },
    {
      apiKey: 0,
      additionalApiData: 0,
    }
  ).sort({ name: 1 });
}

async function getProfile({ profileId }) {
  if (!profileId) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }

  return await findOne(profileId);
}

async function getCampaignMail({ campaignMailId, profileId }) {
  const profile = await findOne(profileId);

  const { apiKey, type, name, _company, additionalApiData } = profile;

  const espProvider = new EspProvider({
    apiKey,
    type,
    name,
    _company,
    additionalApiData,
  });

  return await espProvider.getCampaignMail({ campaignMailId });
}

async function deleteOne(profileId) {
  return Profiles.deleteOne({ _id: Types.ObjectId(profileId) });
}
