'use strict';

// An ESP profile by id: a super admin reaches every company's profiles,
// anyone else its own company's (account/permissions.js). An email is pushed
// to the ESP only through a profile of the email's own company.

const mongoose = require('mongoose');

jest.mock('../../../packages/server/common/models.common', () => ({
  Profiles: { exists: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../../../packages/server/esp/esp.service', () => ({
  build: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  getMailByMailingIdAndUser: jest.fn(),
  resolveMailingTrackingContext: jest.fn(),
  findOne: jest.fn(),
  updateMailEspIds: jest.fn(),
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));

const { Profiles } = require('../../../packages/server/common/models.common');
const EspProvider = require('../../../packages/server/esp/esp.service');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const profileService = require('../../../packages/server/profile/profile.service');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  ALICE,
  DAVE,
  FRANK,
  CLIENT_GROUP,
  PLATFORM_GROUP,
  USERS,
  actorFrom,
} = require('../../helpers/super-admin-fixtures.js');

const actor = (id) => actorFrom(USERS.find((u) => u._id === id));
const profileId = '507f1f77bcf86cd799439f01';
const check = (user) =>
  profileService.checkIfUserIsAuthorizedToAccessProfile({ user, profileId });

beforeEach(() => {
  jest.clearAllMocks();
  Profiles.exists.mockResolvedValue(true);
  Profiles.findOne.mockResolvedValue({
    _id: profileId,
    _company: new mongoose.Types.ObjectId(CLIENT_GROUP),
  });
});

describe('profileService.checkIfUserIsAuthorizedToAccessProfile', () => {
  it.each([
    ['a super admin', actor(ALICE)],
    ['a member of its company', actor(FRANK)],
  ])('lets %s reach it', async (_label, user) => {
    await expect(check(user)).resolves.toBeUndefined();
  });

  it('refuses a member of another company', async () => {
    await expect(check(actor(DAVE))).rejects.toMatchObject({
      status: 401,
      message: ERROR_CODES.FORBIDDEN_PROFILE_ACCESS,
    });
  });
});

describe.each([
  ['sendEspCampaign', {}],
  ['updateEspCampaign', { campaignId: 'campaign-1' }],
])('profileService.%s', (method, extra) => {
  const mailingId = '507f1f77bcf86cd799439e01';
  const provider = {
    createCampaignMail: jest.fn().mockResolvedValue('campaign-1'),
    createTemplate: jest.fn().mockResolvedValue('template-1'),
    updateCampaignMail: jest.fn().mockResolvedValue('campaign-1'),
    updateTemplate: jest.fn().mockResolvedValue('template-1'),
  };

  const profileOf = (group) =>
    Profiles.findOne.mockResolvedValue({
      _id: profileId,
      type: 'SENDINBLUE',
      apiKey: 'key',
      _company: new mongoose.Types.ObjectId(group),
      additionalApiData: { contentSendType: 'MAIL' },
    });
  const mailingOf = (group) =>
    mailingService.getMailByMailingIdAndUser.mockResolvedValue({
      _id: mailingId,
      _company: new mongoose.Types.ObjectId(group),
    });
  const push = (user) =>
    profileService[method]({
      user,
      profileId,
      mailingId,
      type: 'SENDINBLUE',
      html: '<html></html>',
      espSendingMailData: { subject: 'News', campaignMailName: 'News' },
      ...extra,
    });

  beforeEach(() => {
    EspProvider.build.mockResolvedValue(provider);
    mailingService.findOne.mockResolvedValue({ espIds: [] });
  });

  it('pushes the email through a profile of its company', async () => {
    profileOf(CLIENT_GROUP);
    mailingOf(CLIENT_GROUP);

    await expect(push(actor(FRANK))).resolves.toMatchObject({ profileId });
    expect(EspProvider.build).toHaveBeenCalled();
  });

  it('refuses a profile of another company, like one that does not exist', async () => {
    profileOf(PLATFORM_GROUP);
    mailingOf(CLIENT_GROUP);

    await expect(push(actor(FRANK))).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.PROFILE_NOT_FOUND,
    });
    expect(EspProvider.build).not.toHaveBeenCalled();
  });

  it("refuses a super admin a profile of another company than the email's", async () => {
    profileOf(PLATFORM_GROUP);
    mailingOf(CLIENT_GROUP);

    await expect(push(actor(ALICE))).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION,
    });
    expect(EspProvider.build).not.toHaveBeenCalled();
  });
});
