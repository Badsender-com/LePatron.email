'use strict';

// An ESP profile by id: a super admin reaches every company's profiles,
// anyone else its own company's (account/permissions.js).

const mongoose = require('mongoose');

jest.mock('../../../packages/server/common/models.common', () => ({
  Profiles: { exists: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../../../packages/server/esp/esp.service', () => ({}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));

const { Profiles } = require('../../../packages/server/common/models.common');
const profileService = require('../../../packages/server/profile/profile.service');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  ALICE,
  DAVE,
  FRANK,
  CLIENT_GROUP,
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
