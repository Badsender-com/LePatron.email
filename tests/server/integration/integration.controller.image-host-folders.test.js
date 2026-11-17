'use strict';

// The answer of the folder listing when the image host refuses the credentials
// being typed. Never a 401: the settings screen reads a 401 as its own session
// expired and sends the admin away from the form they are filling.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/integration/integration.service', () => ({
  listImageHostFolders: jest.fn(),
}));
jest.mock('../../../packages/server/group/group.service', () => ({
  checkIfUserIsAuthorizedToAccessGroup: jest.fn(),
}));

const integrationService = require('../../../packages/server/integration/integration.service');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../../../packages/server/integration-providers/provider-error.js');
const {
  listImageHostFolders,
} = require('../../../packages/server/integration/integration.controller.js');

function call(body = { provider: 'emarsys', apiKey: 's', config: {} }) {
  const res = { json: jest.fn() };
  const next = jest.fn();
  const req = {
    user: { group: { id: 'group-1' } },
    params: { groupId: 'group-1' },
    body,
  };
  return listImageHostFolders(req, res, next).then(() => ({ res, next }));
}

describe('integration.controller listImageHostFolders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('answers the folders', async () => {
    const folders = [{ id: 4200, parent: 0, name: 'LePatron' }];
    integrationService.listImageHostFolders.mockResolvedValue(folders);

    const { res } = await call();

    expect(res.json).toHaveBeenCalledWith({ folders });
  });

  it('answers refused credentials with a 422 naming the code, never a 401', async () => {
    integrationService.listImageHostFolders.mockRejectedValue(
      new ProviderError(
        'Emarsys token request failed: 401',
        CODES.INVALID_CREDENTIALS
      )
    );

    const { next } = await call();

    const [error] = next.mock.calls[0];
    expect(error.status).toBe(422);
    expect(error.message).toBe(CODES.INVALID_CREDENTIALS);
  });

  it('keeps what the host answered out of the response', async () => {
    integrationService.listImageHostFolders.mockRejectedValue(
      new ProviderError(
        'Emarsys GET /folder failed: 500 1 internal detail',
        CODES.API_ERROR
      )
    );

    const { next } = await call();

    const [error] = next.mock.calls[0];
    expect(error.status).toBe(502);
    expect(error.message).toBe(CODES.API_ERROR);
  });

  it('only forwards the fields it reads', async () => {
    integrationService.listImageHostFolders.mockResolvedValue([]);

    await call({
      provider: 'emarsys',
      apiKey: 's',
      config: { clientId: 'c' },
      groupId: 'another-company',
    });

    expect(integrationService.listImageHostFolders).toHaveBeenCalledWith({
      groupId: 'group-1',
      provider: 'emarsys',
      apiKey: 's',
      config: { clientId: 'c' },
    });
  });
});
