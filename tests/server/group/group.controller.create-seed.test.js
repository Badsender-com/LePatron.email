'use strict';

// POST /groups seeds the default email types. Only a super admin creates a
// company, and their session carries no `lang`: the language has to come from the
// interface, and must not be stored on the company as if it were one of its fields.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: {},
  Profiles: {},
  Templates: {},
  Mailings: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({
  createGroup: jest.fn(),
}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({
  validateSshKeyOrThrow: jest.fn(),
  maskFtpCredentials: jest.fn((group) => group),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  createWorkspace: jest.fn(),
  findWorkspaces: jest.fn(),
}));
jest.mock(
  '../../../packages/server/taxonomy/taxonomy-defaults.service.js',
  () => ({ seedDefaultEmailTypes: jest.fn() })
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const groupService = require('../../../packages/server/group/group.service.js');
const taxonomyDefaultsService = require('../../../packages/server/taxonomy/taxonomy-defaults.service.js');
const groupController = require('../../../packages/server/group/group.controller.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const superAdmin = { isAdmin: true, id: 'admin', name: 'admin' };

async function create(body, user = superAdmin) {
  const res = { json: jest.fn() };
  await groupController.create({ body, user }, res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  groupService.createGroup.mockResolvedValue({
    _id: GROUP_ID,
    id: GROUP_ID,
    name: 'Acme',
  });
});

describe('POST /groups — default email types language', () => {
  it('seeds in the interface language a super admin sends', async () => {
    await create({ name: 'Acme', defaultEmailTypesLang: 'fr' });

    expect(taxonomyDefaultsService.seedDefaultEmailTypes).toHaveBeenCalledWith({
      companyId: GROUP_ID,
      lang: 'fr',
    });
  });

  it('does not store the seed language on the company', async () => {
    await create({ name: 'Acme', defaultEmailTypesLang: 'fr' });

    expect(groupService.createGroup.mock.calls[0][0]).not.toHaveProperty(
      'defaultEmailTypesLang'
    );
  });

  it('falls back on English for a session with no language', async () => {
    await create({ name: 'Acme' });

    expect(
      taxonomyDefaultsService.seedDefaultEmailTypes.mock.calls[0][0].lang
    ).toBe('en');
  });

  it('ignores a language the seed has no labels for', async () => {
    await create({ name: 'Acme', defaultEmailTypesLang: 'de' });

    expect(
      taxonomyDefaultsService.seedDefaultEmailTypes.mock.calls[0][0].lang
    ).toBe('en');
  });

  it('still creates the company when the seed fails', async () => {
    taxonomyDefaultsService.seedDefaultEmailTypes.mockRejectedValue(
      new Error('boom')
    );

    const res = await create({ name: 'Acme', defaultEmailTypesLang: 'fr' });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: GROUP_ID })
    );
  });
});
