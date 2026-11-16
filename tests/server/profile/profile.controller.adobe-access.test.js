'use strict';

// The Adobe lookups of the export modal read a profile's credentials: both
// reach only a profile of the user's company (checkIfUserIsAuthorizedToAccessProfile),
// before the profile is read.

jest.mock('../../../packages/server/profile/profile.service', () => ({
  checkIfUserIsAuthorizedToAccessProfile: jest.fn(),
  findOne: jest.fn(),
  getAdobeFolders: jest.fn(),
  getAdobeDeliveries: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing.service', () => ({}));
jest.mock('../../../packages/server/group/group.service', () => ({}));

const { Unauthorized } = require('http-errors');
const profileService = require('../../../packages/server/profile/profile.service');
const controller = require('../../../packages/server/profile/profile.controller.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const profileId = '507f1f77bcf86cd799439f01';
const user = { id: 'u1', role: 'regular_user', group: { id: 'company-a' } };

function call(handler) {
  return new Promise((resolve) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: (body) => resolve({ status: res.statusCode, body }),
      send: (body) => resolve({ status: 200, body }),
    };
    handler(
      { user, params: { profileId }, query: { fullName: 'Folder' } },
      res,
      (err) => resolve({ status: err.status, message: err.message })
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  profileService.findOne.mockResolvedValue({
    adobeImsUrl: 'https://ims.test',
    adobeBaseUrl: 'https://adobe.test',
    apiKey: 'key',
    secretKey: 'secret',
    additionalApiData: {},
  });
  profileService.getAdobeFolders.mockResolvedValue([]);
  profileService.getAdobeDeliveries.mockResolvedValue([]);
});

describe.each([
  ['getAdobeFolders', 'getAdobeFolders'],
  ['getAdobeDeliveries', 'getAdobeDeliveries'],
])('%s', (handler, serviceCall) => {
  it("reads a profile of the user's company", async () => {
    profileService.checkIfUserIsAuthorizedToAccessProfile.mockResolvedValue();

    const result = await call(controller[handler]);

    expect(result.status).toBe(200);
    expect(
      profileService.checkIfUserIsAuthorizedToAccessProfile
    ).toHaveBeenCalledWith({ user, profileId });
  });

  it('reads nothing of a profile the user does not reach', async () => {
    profileService.checkIfUserIsAuthorizedToAccessProfile.mockRejectedValue(
      new Unauthorized(ERROR_CODES.FORBIDDEN_PROFILE_ACCESS)
    );

    const result = await call(controller[handler]);

    expect(result).toEqual({
      status: 401,
      message: ERROR_CODES.FORBIDDEN_PROFILE_ACCESS,
    });
    expect(profileService.findOne).not.toHaveBeenCalled();
    expect(profileService[serviceCall]).not.toHaveBeenCalled();
  });
});
