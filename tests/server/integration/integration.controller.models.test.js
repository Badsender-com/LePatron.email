'use strict';

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/integration/integration.service', () => ({
  checkIfUserIsAuthorizedToAccessIntegration: jest.fn(),
}));
jest.mock(
  '../../../packages/server/integration-providers/provider-factory.js',
  () => ({ createProvider: jest.fn() })
);
jest.mock(
  '../../../packages/server/integration-providers/ai/model-listing.service.js',
  () => ({ listModelsForIntegration: jest.fn() })
);

const integrationService = require('../../../packages/server/integration/integration.service');
const ProviderFactory = require('../../../packages/server/integration-providers/provider-factory.js');
const modelListingService = require('../../../packages/server/integration-providers/ai/model-listing.service.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../../../packages/server/integration-providers/provider-error.js');
const {
  getModels,
} = require('../../../packages/server/integration/integration.controller.js');

function call() {
  const res = { json: jest.fn() };
  const next = jest.fn();
  const req = {
    user: { group: { id: 'group-1' } },
    params: { integrationId: 'integration-1' },
    query: {},
  };
  return getModels(req, res, next).then(() => ({ res, next }));
}

describe('integration.controller getModels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    integrationService.checkIfUserIsAuthorizedToAccessIntegration.mockResolvedValue(
      { _id: 'integration-1', provider: 'infomaniak' }
    );
  });

  // Every Infomaniak integration saved while productId was being dropped has
  // none: the provider throws from its constructor.
  it('answers with the fallback shape when the provider cannot be built', async () => {
    ProviderFactory.createProvider.mockImplementation(() => {
      throw new ProviderError(
        'Infomaniak provider requires a productId',
        CODES.CONFIG_ERROR
      );
    });

    const { res, next } = await call();

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [],
        source: 'catalog',
        error: CODES.CONFIG_ERROR,
        capabilities: expect.objectContaining({ supportsModelSelection: true }),
      })
    );
    expect(modelListingService.listModelsForIntegration).not.toHaveBeenCalled();
  });

  it('checks access before anything else', async () => {
    integrationService.checkIfUserIsAuthorizedToAccessIntegration.mockRejectedValue(
      new Error('FORBIDDEN_INTEGRATION_ACCESS')
    );

    const { res, next } = await call();

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(ProviderFactory.createProvider).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('passes the listing through, error code included', async () => {
    ProviderFactory.createProvider.mockReturnValue({
      getCapabilities: () => ({
        supportsModelSelection: true,
        supportsFormality: false,
      }),
      _getDefaultModel: () => 'mistral3',
    });
    modelListingService.listModelsForIntegration.mockResolvedValue({
      models: [{ id: 'mistral3' }],
      source: 'catalog',
      error: CODES.API_ERROR,
    });

    const { res } = await call();

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [{ id: 'mistral3' }],
        defaultModel: 'mistral3',
        error: CODES.API_ERROR,
      })
    );
  });
});
