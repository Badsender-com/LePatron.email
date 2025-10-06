const EspProvider = require('../esp/esp.service');
const { Profiles } = require('../common/models.common');
const { Types } = require('mongoose');
const ESP_CONTENT_TYPE = require('../constant/content-esp-type.js');

const ERROR_CODES = require('../constant/error-codes.js');

const {
  NotFound,
  Conflict,
  InternalServerError,
  Unauthorized,
} = require('http-errors');
const mailingService = require('../mailing/mailing.service.js');
const groupService = require('../group/group.service.js');
const EspTypes = require('../constant/esp-type');

module.exports = {
  createProfile,
  updateProfile,
  sendEspCampaign,
  findAllByGroup,
  deleteProfile,
  findOne,
  profileListEditor,
  getCampaignMail,
  getProfile,
  actitoEntitiesList,
  actitoTargetTablesList,
  findOneWithoutApiKey,
  checkIfUserIsAuthorizedToAccessProfile,
  updateEspCampaign,
  getAdobeFolders,
  getAdobeDeliveries,
};

async function checkIfUserIsAuthorizedToAccessProfile({ user, profileId }) {
  const profile = await findOne(profileId);
  if (!user.isAdmin) {
    if (user?.group.id !== profile?._company?.toString()) {
      throw new Unauthorized(ERROR_CODES.FORBIDDEN_PROFILE_ACCESS);
    }
  }
}

async function actitoEntitiesList({ apiKey }) {
  const espProvider = await EspProvider.build({
    apiKey,
    type: EspTypes.ACTITO,
  });
  return await espProvider.getAllEspEntities();
}

async function actitoTargetTablesList({ apiKey, entity }) {
  const espProvider = await EspProvider.build({
    apiKey,
    type: EspTypes.ACTITO,
  });

  return espProvider.getAllEspProfileTableName({ entity });
}

async function createProfile({
  user,
  name,
  type,
  adobeImsUrl,
  adobeBaseUrl,
  apiKey,
  secretKey,
  targetType,
  _company,
  additionalApiData,
}) {
  const cleanAdobeBaseUrl = adobeBaseUrl?.replace(/\/+$/, '') || adobeBaseUrl;

  const espProvider = await EspProvider.build({
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    targetType,
    userId: user.id,
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
  let accessToken = null;
  if (espConnectionResult?.data?.access_token) {
    accessToken = espConnectionResult.data.access_token;
  }
  return Profiles.create({
    name,
    type,
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    targetType,
    accessToken,
    _company,
    additionalApiData,
  });
}

async function updateProfile({
  user,
  id,
  name,
  type,
  adobeImsUrl,
  adobeBaseUrl,
  apiKey,
  secretKey,
  targetType,
  _company,
  additionalApiData,
}) {
  await findOne(id);
  const cleanAdobeBaseUrl = adobeBaseUrl?.replace(/\/+$/, '') || adobeBaseUrl;

  const espProvider = await EspProvider.build({
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    targetType,
    userId: user.id,
    type,
    name,
    _company,
    additionalApiData,
  });

  const espConnectionResult = await espProvider.connectApi();
  if (!espConnectionResult) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }

  return Profiles.updateOne(
    { _id: Types.ObjectId(id) },
    {
      name,
      type,
      adobeImsUrl,
      adobeBaseUrl: cleanAdobeBaseUrl,
      apiKey,
      secretKey,
      targetType,
      _company,
      additionalApiData,
    }
  );
}

async function updateEspCampaign({
  user,
  espSendingMailData,
  profileId,
  html,
  mailingId,
  campaignId,
  type,
}) {
  const { subject, campaignMailName, planification } = espSendingMailData;
  const profile = await findOne(profileId);

  const {
    apiKey,
    secretKey,
    adobeBaseUrl,
    adobeImsUrl,
    accessToken,
    type: profileType,
    name,
    _company,
    additionalApiData,
  } = profile;

  const { contentSendType } = additionalApiData;

  if (profileType !== type) {
    throw new NotFound(ERROR_CODES.INCOHERENT_PROFILE_TYPES);
  }
  const cleanAdobeBaseUrl = adobeBaseUrl?.replace(/\/+$/, '') || adobeBaseUrl;

  const espProvider = await EspProvider.build({
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    accessToken,
    profileId,
    userId: user.id,
    type,
    name,
    _company,
    additionalApiData,
  });

  let campaignMailData = {
    ...additionalApiData,
    subject,
    planification,
    name: campaignMailName,
  };

  if (type === EspTypes.ADOBE) {
    campaignMailData = {
      ...campaignMailData,
      adobe: espSendingMailData.adobe,
    };
  }

  const espCampaignId =
    contentSendType === ESP_CONTENT_TYPE.MAIL
      ? await espProvider.updateCampaignMail({
          user,
          html,
          mailingId,
          campaignMailData,
          campaignId,
          ...additionalApiData,
        })
      : await espProvider.updateTemplate({
          user,
          html,
          mailingId,
          campaignMailData,
          campaignId,
        });

  return {
    profileId,
    campaignId: espCampaignId,
  };
}

async function sendEspCampaign({
  user,
  espSendingMailData,
  profileId,
  html,
  mailingId,
  type,
}) {
  const { subject, campaignMailName, planification } = espSendingMailData;
  const profile = await findOne(profileId);

  /*
    For DSC, creating a new campaign from the same profile is allowed
    if the campaign was deleted on DSC's side
  */
  if (type !== 'DSC') {
    await checkIfMailAlreadySentToProfile({ profileId, mailingId });
  }

  const {
    adobeImsUrl,
    adobeBaseUrl,
    apiKey,
    secretKey,
    targetType,
    accessToken,
    type: profileType,
    name,
    _company,
    additionalApiData,
  } = profile;

  if (profileType !== type) {
    throw new NotFound(ERROR_CODES.INCOHERENT_PROFILE_TYPES);
  }
  const cleanAdobeBaseUrl = adobeBaseUrl?.replace(/\/+$/, '') || adobeBaseUrl;

  const espProvider = await EspProvider.build({
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    targetType,
    accessToken,
    profileId,
    userId: user.id,
    type,
    name,
    _company,
    additionalApiData,
  });

  let campaignMailData = {
    ...additionalApiData,
    subject,
    planification,
    name: campaignMailName,
  };

  if (type === EspTypes.ADOBE) {
    campaignMailData = {
      ...campaignMailData,
      adobe: espSendingMailData.adobe,
    };
  }

  const { contentSendType } = additionalApiData;
  const espCampaignId =
    contentSendType === ESP_CONTENT_TYPE.MAIL
      ? await espProvider.createCampaignMail({
          user,
          html,
          mailingId,
          campaignMailData,
        })
      : await espProvider.createTemplate({
          user,
          html,
          mailingId,
          campaignMailData,
        });

  await mailingService.updateMailEspIds(mailingId, {
    profileId,
    campaignId: espCampaignId,
  });

  return {
    profileId,
    campaignId: espCampaignId,
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

  mailing.espIds?.forEach((espId) => {
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

  return findOne(profileId);
}

async function getCampaignMail({ campaignId, profileId, user }) {
  const profile = await findOne(profileId);

  const {
    apiKey,
    secretKey,
    adobeBaseUrl,
    adobeImsUrl,
    accessToken,
    type,
    name,
    _company,
    additionalApiData,
  } = profile;

  const { contentSendType, internalName } = additionalApiData;
  const cleanAdobeBaseUrl = adobeBaseUrl?.replace(/\/+$/, '') || adobeBaseUrl;

  const espProvider = await EspProvider.build({
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    accessToken,
    profileId,
    userId: user.id,
    type,
    name,
    _company,
    additionalApiData,
  });

  let campaignMailResponse = null;
  if (contentSendType === ESP_CONTENT_TYPE.MAIL) {
    campaignMailResponse = await espProvider.getCampaignMail({
      campaignId,
      ...additionalApiData,
      internalName,
    });
  } else {
    campaignMailResponse = await espProvider.getTemplate({
      campaignId,
    });
  }
  const { additionalApiData: additionalApiDataFromESP } = campaignMailResponse;

  return {
    ...campaignMailResponse,
    id: profileId,
    type,
    additionalApiData: {
      ...additionalApiDataFromESP,
      contentSendType,
    },
  };
}

async function deleteOne(profileId) {
  return Profiles.deleteOne({ _id: Types.ObjectId(profileId) });
}

async function getAdobeFolders({
  user,
  adobeImsUrl,
  adobeBaseUrl,
  apiKey,
  secretKey,
  targetType,
  accessToken,
  profileId,
}) {
  const cleanAdobeBaseUrl = adobeBaseUrl?.replace(/\/+$/, '') || adobeBaseUrl;

  const espProvider = await EspProvider.build({
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    targetType,
    accessToken,
    profileId,
    userId: user.id,
    type: EspTypes.ADOBE,
  });

  const groupNames = await espProvider.getUserGroups({ user });

  return await espProvider.getFoldersFromGroupNames({
    groupNames,
    type: targetType,
  });
}
async function getAdobeDeliveries({
  adobeImsUrl,
  adobeBaseUrl,
  apiKey,
  secretKey,
  targetType,
  accessToken,
  profileId,
  userId,
  fullName,
}) {
  const cleanAdobeBaseUrl = adobeBaseUrl?.replace(/\/+$/, '') || adobeBaseUrl;

  const espProvider = await EspProvider.build({
    adobeImsUrl,
    adobeBaseUrl: cleanAdobeBaseUrl,
    apiKey,
    secretKey,
    targetType,
    accessToken,
    profileId,
    userId,
    type: EspTypes.ADOBE,
  });

  return await espProvider.getDeliveriesFromFolderFullNameOrInternalName({
    fullName,
    type: targetType,
  });
}
