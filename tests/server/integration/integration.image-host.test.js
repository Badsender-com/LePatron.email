'use strict';

// An Emarsys account as an image host integration (ADR 0028): what a tech
// admin may store for it, how its credentials are checked, and what deleting
// it forgets. Emarsys is faked behind node-fetch; the provider factory is the
// real one, so these tests also pin that `emarsys` is registered in it.

jest.mock('node-fetch');
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  ...jest.requireActual('../../../packages/server/utils/outbound-host.js'),
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common', () => ({
  Integrations: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    exists: jest.fn(),
  },
  Dashboards: { deleteMany: jest.fn() },
  AIFeatureConfigs: { updateMany: jest.fn() },
  HostedImages: { deleteMany: jest.fn() },
}));
jest.mock('../../../packages/server/group/group.service', () => ({
  findById: jest.fn(),
}));

const fetch = require('node-fetch');
const mongoose = require('mongoose');
const {
  Integrations,
  Dashboards,
  HostedImages,
} = require('../../../packages/server/common/models.common');
const integrationService = require('../../../packages/server/integration/integration.service');
const {
  validateIntegrationConfig,
} = require('../../../packages/server/integration/integration.validation.js');
const IntegrationSchema = require('../../../packages/server/integration/integration.schema.js');

const COMPANY = new mongoose.Types.ObjectId();
const INTEGRATION = new mongoose.Types.ObjectId();
const CONFIG = { clientId: 'client-123', rootFolderId: 4200 };

function emarsysAnswers({ token = 200 } = {}) {
  fetch.mockImplementation(async (url) => {
    const reply = (status, body) => ({
      status,
      ok: status >= 200 && status < 300,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
    if (url.startsWith('https://auth.emarsys.net/oauth2/token')) {
      return token === 200
        ? reply(200, { access_token: 'jwt', expires_in: 3600 })
        : reply(token, { error: 'invalid_client' });
    }
    if (url.startsWith('https://api.emarsys.net/api/v3/folder')) {
      return reply(200, {
        replyCode: 0,
        data: [{ id: 4200, parent: 0, name: 'LePatron' }],
      });
    }
    return reply(404, { replyCode: 1 });
  });
}

describe('an Emarsys integration: what may be stored', () => {
  const Integration = mongoose.model(
    'IntegrationImageHostTest',
    IntegrationSchema
  );

  beforeEach(() => {
    jest.clearAllMocks();
    Integrations.exists.mockResolvedValue(false);
    Integrations.create.mockImplementation(async (doc) => doc);
  });

  it('is an image host the schema accepts, with its secret required', async () => {
    const build = (overrides) =>
      new Integration({
        name: 'Emarsys – Brand A',
        type: 'asset_hosting',
        provider: 'emarsys',
        _company: COMPANY,
        apiKey: 'secret',
        config: CONFIG,
        ...overrides,
      });

    await expect(build().validate()).resolves.toBeUndefined();
    await expect(build({ apiKey: undefined }).validate()).rejects.toThrow();
  });

  it('never returns the secret', () => {
    const integration = new Integration({
      name: 'Emarsys – Brand A',
      type: 'asset_hosting',
      provider: 'emarsys',
      _company: COMPANY,
      apiKey: 'secret',
      config: CONFIG,
    });

    expect(integration.toJSON().apiKey).toBeUndefined();
  });

  it('accepts a client ID and a root folder', () => {
    expect(validateIntegrationConfig('emarsys', CONFIG)).toEqual(CONFIG);
  });

  it.each([
    ['without a root folder', { clientId: 'client-123' }],
    ['without a client ID', { rootFolderId: 4200 }],
    [
      'with a root folder that is not an identifier',
      { ...CONFIG, rootFolderId: '../42' },
    ],
    ['with a key Emarsys does not read', { ...CONFIG, folder: 12 }],
  ])('refuses a configuration %s', (_label, config) => {
    expect(() => validateIntegrationConfig('emarsys', config)).toThrow(
      'INTEGRATION_CONFIG_INVALID'
    );
  });

  it('refuses to create an Emarsys integration with no configuration', async () => {
    await expect(
      integrationService.createIntegration({
        name: 'Emarsys – Brand A',
        type: 'asset_hosting',
        provider: 'emarsys',
        apiKey: 'secret',
        _company: COMPANY,
      })
    ).rejects.toThrow('INTEGRATION_CONFIG_INVALID');
    expect(Integrations.create).not.toHaveBeenCalled();
  });

  it('creates an Emarsys integration, pending its first test', async () => {
    const created = await integrationService.createIntegration({
      name: 'Emarsys – Brand A',
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: 'secret',
      config: CONFIG,
      _company: COMPANY,
    });

    expect(created).toMatchObject({
      type: 'asset_hosting',
      provider: 'emarsys',
      config: CONFIG,
      validationStatus: 'pending',
    });
  });
});

describe('an Emarsys integration: testing its credentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Integrations.findById.mockResolvedValue({
      _id: INTEGRATION,
      name: 'Emarsys – Brand A',
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: 'secret',
      config: CONFIG,
      _company: COMPANY,
    });
  });

  it('marks it valid when Emarsys accepts them', async () => {
    emarsysAnswers();

    await integrationService.validateCredentials({
      integrationId: String(INTEGRATION),
    });

    expect(Integrations.findByIdAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ validationStatus: 'valid' })
    );
  });

  it('marks it invalid when Emarsys refuses them', async () => {
    emarsysAnswers({ token: 401 });

    await integrationService.validateCredentials({
      integrationId: String(INTEGRATION),
    });

    expect(Integrations.findByIdAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ validationStatus: 'invalid' })
    );
  });
});

// The tech admin picks the root folder from the folders of the account, before
// the integration is saved (its credentials typed) or while editing it (its
// secret stored, never sent back to the screen).
describe('an Emarsys integration: listing the folders of the account', () => {
  const OTHER_COMPANY = new mongoose.Types.ObjectId();
  const basicOf = (clientId, secret) =>
    `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;
  const tokenAuthorization = () =>
    fetch.mock.calls.find(([url]) => url.startsWith('https://auth.'))[1].headers
      .Authorization;

  function stored(overrides = {}) {
    Integrations.findById.mockResolvedValue({
      _id: INTEGRATION,
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: 'stored-secret',
      config: CONFIG,
      _company: COMPANY,
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    emarsysAnswers();
  });

  it('lists them from credentials not saved yet', async () => {
    const folders = await integrationService.listImageHostFolders({
      groupId: String(COMPANY),
      provider: 'emarsys',
      apiKey: 'typed-secret',
      config: { clientId: 'client-123' },
    });

    expect(folders).toEqual([{ id: 4200, parent: 0, name: 'LePatron' }]);
    expect(tokenAuthorization()).toBe(basicOf('client-123', 'typed-secret'));
  });

  it('lists them with the stored secret, when editing', async () => {
    stored();

    await integrationService.listImageHostFolders({
      groupId: String(COMPANY),
      integrationId: String(INTEGRATION),
    });

    expect(tokenAuthorization()).toBe(basicOf('client-123', 'stored-secret'));
  });

  it('takes the client ID and the secret being typed over the stored ones', async () => {
    stored();

    await integrationService.listImageHostFolders({
      groupId: String(COMPANY),
      integrationId: String(INTEGRATION),
      apiKey: 'new-secret',
      config: { clientId: 'client-789' },
    });

    expect(tokenAuthorization()).toBe(basicOf('client-789', 'new-secret'));
  });

  it('refuses an integration of another company, and sends its secret nowhere', async () => {
    stored({ _company: OTHER_COMPANY });

    await expect(
      integrationService.listImageHostFolders({
        groupId: String(COMPANY),
        integrationId: String(INTEGRATION),
      })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['a provider that is not an image host', { provider: 'openai' }],
    ['no provider', {}],
  ])('refuses %s', async (_label, request) => {
    await expect(
      integrationService.listImageHostFolders({
        groupId: String(COMPANY),
        apiKey: 'typed-secret',
        config: { clientId: 'client-123' },
        ...request,
      })
    ).rejects.toThrow('INTEGRATION_CONFIG_INVALID');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says when Emarsys refuses the credentials', async () => {
    emarsysAnswers({ token: 401 });

    await expect(
      integrationService.listImageHostFolders({
        groupId: String(COMPANY),
        provider: 'emarsys',
        apiKey: 'wrong',
        config: { clientId: 'client-123' },
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_CREDENTIALS' });
  });
});

describe('an Emarsys integration: deleting it', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Integrations.findById.mockResolvedValue({
      _id: INTEGRATION,
      type: 'asset_hosting',
      provider: 'emarsys',
      _company: COMPANY,
    });
    Integrations.deleteOne.mockResolvedValue({ deletedCount: 1 });
    Dashboards.deleteMany.mockResolvedValue({ deletedCount: 0 });
    HostedImages.deleteMany.mockResolvedValue({ deletedCount: 3 });
  });

  it('forgets its hosted images', async () => {
    await integrationService.deleteIntegration({
      integrationId: String(INTEGRATION),
    });

    expect(HostedImages.deleteMany).toHaveBeenCalledTimes(1);
    const [filter] = HostedImages.deleteMany.mock.calls[0];
    expect(Object.values(filter).map(String)).toContain(String(INTEGRATION));
  });
});
