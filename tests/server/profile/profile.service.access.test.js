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
  assertUserCanEditMailing: jest.fn(),
  assertUserCanReadMailing: jest.fn(),
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));

const { Forbidden, NotFound } = require('http-errors');
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

  it('answers a member of another company like a profile that does not exist', async () => {
    await expect(check(actor(DAVE))).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.PROFILE_NOT_FOUND,
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
  // The campaign the email already has on this profile: an update edits it.
  const mailingOf = (group) =>
    mailingService.getMailByMailingIdAndUser.mockResolvedValue({
      _id: mailingId,
      _company: new mongoose.Types.ObjectId(group),
      espIds: [
        {
          profileId: new mongoose.Types.ObjectId(profileId),
          campaignId: 'campaign-1',
        },
      ],
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
    mailingService.assertUserCanReadMailing.mockResolvedValue(undefined);
    // Never asked: a reviewer, who writes no email, exports (ADR 0004).
    mailingService.assertUserCanEditMailing.mockRejectedValue(new Forbidden());
  });

  // Exporting is open to every role (ADR 0004; rbac-refonte §3.6): the push
  // asks the read rule of the email, not the rule of saving it.
  it('asks the read rule of the email', async () => {
    profileOf(CLIENT_GROUP);
    mailingOf(CLIENT_GROUP);
    const user = actor(FRANK);

    await push(user);

    expect(mailingService.assertUserCanReadMailing).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ _id: mailingId })
    );
    expect(mailingService.assertUserCanEditMailing).not.toHaveBeenCalled();
  });

  it('pushes nothing when the user may not read the email', async () => {
    profileOf(CLIENT_GROUP);
    mailingOf(CLIENT_GROUP);
    mailingService.assertUserCanReadMailing.mockRejectedValue(new NotFound());

    await expect(push(actor(FRANK))).rejects.toMatchObject({ status: 404 });
    expect(EspProvider.build).not.toHaveBeenCalled();
    expect(mailingService.updateMailEspIds).not.toHaveBeenCalled();
  });

  // Every role, the reviewer included, pushes an email it may read, through a
  // profile of the email's company: the route asks mailing.export, which every
  // role holds (ADR 0004).
  const userOfRole = (role) => ({
    id: '507f1f77bcf86cd799439111',
    role,
    group: { id: role === 'super_admin' ? PLATFORM_GROUP : CLIENT_GROUP },
  });
  // Expected answer: [profile of the email's company, of another company].
  const RIGHTS = [
    ['super_admin', 'pushed', 403],
    ['company_admin_tech', 'pushed', 404],
    ['company_admin', 'pushed', 404],
    ['regular_user', 'pushed', 404],
    ['writer', 'pushed', 404],
    ['reviewer', 'pushed', 404],
  ];

  it.each(RIGHTS.map(([role, expected]) => [role, expected]))(
    '%s: %s through a profile of the email company',
    async (role) => {
      profileOf(CLIENT_GROUP);
      mailingOf(CLIENT_GROUP);

      await expect(push(userOfRole(role))).resolves.toMatchObject({
        profileId,
      });
      expect(EspProvider.build).toHaveBeenCalled();
    }
  );

  it.each(RIGHTS.map(([role, , status]) => [role, status]))(
    '%s: %i through a profile of another company',
    async (role, status) => {
      profileOf(PLATFORM_GROUP);
      mailingOf(CLIENT_GROUP);

      await expect(push(userOfRole(role))).rejects.toMatchObject({
        status,
        message:
          status === 404
            ? ERROR_CODES.PROFILE_NOT_FOUND
            : ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION,
      });
      expect(EspProvider.build).not.toHaveBeenCalled();
    }
  );
});

describe('profileService.updateEspCampaign, the campaign updated', () => {
  const mailingId = '507f1f77bcf86cd799439e01';
  const OTHER_PROFILE = '507f1f77bcf86cd799439f02';

  const emailWith = (espIds) =>
    mailingService.getMailByMailingIdAndUser.mockResolvedValue({
      _id: mailingId,
      _company: new mongoose.Types.ObjectId(CLIENT_GROUP),
      espIds,
    });
  const update = (campaignId) =>
    profileService.updateEspCampaign({
      user: actor(FRANK),
      profileId,
      mailingId,
      campaignId,
      type: 'SENDINBLUE',
      html: '<html></html>',
      espSendingMailData: { subject: 'News', campaignMailName: 'News' },
    });

  beforeEach(() => {
    Profiles.findOne.mockResolvedValue({
      _id: profileId,
      type: 'SENDINBLUE',
      apiKey: 'key',
      _company: new mongoose.Types.ObjectId(CLIENT_GROUP),
      additionalApiData: { contentSendType: 'MAIL' },
    });
    mailingService.assertUserCanReadMailing.mockResolvedValue(undefined);
    EspProvider.build.mockResolvedValue({
      updateCampaignMail: jest.fn().mockResolvedValue('campaign-1'),
    });
  });

  it('updates a campaign the email has on this profile', async () => {
    emailWith([{ profileId, campaignId: 12 }]);

    await expect(update('12')).resolves.toMatchObject({ profileId });
  });

  it.each([
    ['the email has no campaign', []],
    ['the campaign is another one', [{ profileId, campaignId: 'other' }]],
    [
      'the campaign is on another profile',
      [{ profileId: OTHER_PROFILE, campaignId: '12' }],
    ],
  ])('answers like a missing campaign when %s', async (_case, espIds) => {
    emailWith(espIds);

    await expect(update('12')).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.ESP_CAMPAIGN_NOT_FOUND,
    });
    expect(EspProvider.build).not.toHaveBeenCalled();
  });
});
