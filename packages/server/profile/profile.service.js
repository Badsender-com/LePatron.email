const EspProvider = require('../esp/esp.service');
const { Profiles } = require('../common/models.common');
const { Types } = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');

const { NotFound, Conflict } = require('http-errors');

module.exports = {
  create,
  sendCampaignMail,
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

async function sendCampaignMail({ espRequestData, profileId, type }) {
  const profile = await findOne(profileId);
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
  const espCampaignMailResult = await espProvider.createCampaignMail(
    espRequestData
  );

  console.log({ espCampaignMailResult });
}

async function findOne(profileId) {
  if (!(await Profiles.exists({ _id: Types.ObjectId(profileId) }))) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }
  return Profiles.findOne({ _id: Types.ObjectId(profileId) });
}
