'use strict';

const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);
jest.mock('../../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const AzureOpenAIProvider = require('../../../../packages/server/integration-providers/ai/azure-openai-provider');
const OpenAICompatibleProvider = require('../../../../packages/server/integration-providers/ai/openai-compatible-provider');
const ScalewayProvider = require('../../../../packages/server/integration-providers/ai/scaleway-provider');
const OvhProvider = require('../../../../packages/server/integration-providers/ai/ovh-provider');
const {
  PROVIDER_ERROR_CODES: CODES,
} = require('../../../../packages/server/integration-providers/provider-error.js');

function reply(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const chatResponse = {
  choices: [{ message: { content: 'ok' } }],
  usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
};

describe('AzureOpenAIProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  function build(config = {}) {
    return new AzureOpenAIProvider({
      provider: 'azure_openai',
      apiKey: 'azure-key',
      apiHost: 'https://my-instance.openai.azure.com',
      config,
    });
  }

  // The resource host is what the deployment path is built from: without it
  // there is no URL to call.
  it('refuses to be built without a host', () => {
    expect(
      () =>
        new AzureOpenAIProvider({
          provider: 'azure_openai',
          apiKey: 'k',
          config: {},
        })
    ).toThrow(expect.objectContaining({ code: CODES.CONFIG_ERROR }));
  });

  it('builds the deployment path with a pinned api-version', async () => {
    mockFetch.mockResolvedValue(reply(chatResponse));

    await build({ deployment: 'my-deploy' }).chatComplete({
      messages: [{ role: 'user', content: 'x' }],
    });

    expect(String(mockFetch.mock.calls[0][0])).toBe(
      'https://my-instance.openai.azure.com/openai/deployments/my-deploy/chat/completions?api-version=2024-10-21'
    );
  });

  it('authenticates with api-key, never a Bearer token', async () => {
    mockFetch.mockResolvedValue(reply(chatResponse));

    await build({ deployment: 'my-deploy' }).chatComplete({
      messages: [{ role: 'user', content: 'x' }],
    });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['api-key']).toBe('azure-key');
    // Inheriting the Bearer header produces a 401 with nothing actionable.
    expect(headers.Authorization).toBeUndefined();
  });

  it('reports no default when no deployment is configured', () => {
    expect(() => build()._getDefaultModel()).toThrow(
      expect.objectContaining({ code: CODES.CONFIG_ERROR })
    );
  });

  // Deployment names are chosen by the customer, so nothing can be listed or
  // guessed: free typing is what makes this provider usable.
  it('offers no remote listing', async () => {
    expect(await build({ deployment: 'd' }).listRemoteModels()).toBeNull();
  });
});

// A deployment name says nothing about the model behind it: `prod-chat` may
// run gpt-5, which refuses max_tokens and any explicit temperature.
describe('AzureOpenAIProvider on a reasoning deployment', () => {
  beforeEach(() => jest.clearAllMocks());

  function build(config) {
    return new AzureOpenAIProvider({
      provider: 'azure_openai',
      apiKey: 'azure-key',
      apiHost: 'https://my-instance.openai.azure.com',
      config: { deployment: 'prod-chat', ...config },
    });
  }

  async function sentBody(provider) {
    mockFetch.mockResolvedValueOnce(reply(chatResponse));
    await provider.chatComplete({
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.3,
    });
    return JSON.parse(mockFetch.mock.calls[0][1].body);
  }

  it('speaks the newer contract when the admin says so', async () => {
    const body = await sentBody(build({ reasoningModel: true }));

    expect(body.max_completion_tokens).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('temperature');
  });

  it('keeps the older contract otherwise', async () => {
    const body = await sentBody(build({}));

    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.temperature).toBe(0.3);
  });

  // The pinned api-version predates reasoning_effort on Azure.
  it('never sends a reasoning effort', async () => {
    const provider = build({ reasoningModel: true });
    mockFetch.mockResolvedValueOnce(reply(chatResponse));

    await provider
      .translateBatch({
        texts: { text: 'Bonjour' },
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      })
      .catch(() => {});

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('encodes the api-version in the query', () => {
    const provider = build({ apiVersion: '2024-10-21' });
    provider.apiVersion = 'x&y=1#z';

    expect(provider._getEndpointUrl()).toContain('api-version=x%26y%3D1%23z');
  });
});

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses to be built without an endpoint', () => {
    expect(
      () =>
        new OpenAICompatibleProvider({
          provider: 'openai_compatible',
          apiKey: 'k',
          config: {},
        })
    ).toThrow(expect.objectContaining({ code: CODES.CONFIG_ERROR }));
  });

  it('requires a model name, having no catalogue to fall back on', () => {
    const provider = new OpenAICompatibleProvider({
      provider: 'openai_compatible',
      apiKey: 'k',
      apiHost: 'https://llm.example.com',
      config: {},
    });

    expect(() => provider._getDefaultModel()).toThrow(
      expect.objectContaining({ code: CODES.CONFIG_ERROR })
    );
  });

  // Promising JSON mode on an unknown endpoint makes skills fail at output
  // parsing instead of degrading to the repair pass.
  it('does not claim JSON mode unless told to', () => {
    const build = (config) =>
      new OpenAICompatibleProvider({
        provider: 'openai_compatible',
        apiKey: 'k',
        apiHost: 'https://llm.example.com',
        config,
      });

    expect(build({ model: 'm' }).supportsJsonResponseFormat()).toBe(false);
    expect(
      build({ model: 'm', supportsJsonMode: true }).supportsJsonResponseFormat()
    ).toBe(true);
  });
});

describe.each([
  ['ScalewayProvider', ScalewayProvider, 'scaleway', 'https://api.scaleway.ai'],
  [
    'OvhProvider',
    OvhProvider,
    'ovh',
    'https://oai.endpoints.kepler.ai.cloud.ovh.net',
  ],
])('%s', (_name, Provider, providerId, defaultHost) => {
  function build(overrides = {}) {
    return new Provider({
      provider: providerId,
      apiKey: 'k',
      config: { model: 'm' },
      ...overrides,
    });
  }

  it('falls back to its own public host', () => {
    expect(build().baseUrl).toBe(defaultHost);
  });

  it('lets an account-specific host override it', () => {
    expect(build({ apiHost: 'https://scoped.example.com' }).baseUrl).toBe(
      'https://scoped.example.com'
    );
  });

  it('uses the configured model', () => {
    expect(build()._getDefaultModel()).toBe('m');
  });

  // Both answer 403 for an invalid key, not the 401 the OpenAI dialect
  // expects — verified by calling them. Left to the default it surfaces as a
  // generic API error, sending the admin looking anywhere but at the key.
  it('reads a 403 as invalid credentials', () => {
    expect(build()._mapErrorToCode(403, {})).toBe(CODES.INVALID_CREDENTIALS);
  });

  it('still defers to the dialect for the other statuses', () => {
    expect(build()._mapErrorToCode(429, {})).toBe(CODES.QUOTA_EXCEEDED);
    expect(build()._mapErrorToCode(500, {})).toBe(CODES.API_ERROR);
  });
});
