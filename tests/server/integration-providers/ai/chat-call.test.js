'use strict';

const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);
jest.mock('../../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const OpenAIProvider = require('../../../../packages/server/integration-providers/ai/openai-provider');
const AzureOpenAIProvider = require('../../../../packages/server/integration-providers/ai/azure-openai-provider');
const AnthropicProvider = require('../../../../packages/server/integration-providers/ai/anthropic-provider');
const GeminiProvider = require('../../../../packages/server/integration-providers/ai/gemini-provider');
const quirksCache = require('../../../../packages/server/integration-providers/ai/param-quirks.cache');
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

function refusal(param) {
  return reply(
    {
      error: {
        message: `Unsupported parameter: '${param}' is not supported with this model.`,
        type: 'invalid_request_error',
        param,
        code: 'unsupported_parameter',
      },
    },
    400
  );
}

const chatResponse = {
  choices: [{ message: { content: 'ok' } }],
  usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
};

const messages = [{ role: 'user', content: 'x' }];

function sentBody(callIndex) {
  return JSON.parse(mockFetch.mock.calls[callIndex][1].body);
}

describe('_callChatCompletionRaw', () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    quirksCache.clear();
    provider = new OpenAIProvider({ provider: 'openai', apiKey: 'sk-test' });
  });

  // The body is read after the headers are in, so it fails as a raw
  // FetchError. It must come out typed like the request itself, or a timeout
  // reads as a JavaScript bug.
  it.each([
    ['body-timeout', CODES.TIMEOUT],
    ['max-size', CODES.INVALID_RESPONSE],
    ['invalid-json', CODES.INVALID_RESPONSE],
  ])('types a %s while reading the body', async (type, code) => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw Object.assign(new Error('boom'), { name: 'FetchError', type });
      },
    });

    await expect(
      provider.chatComplete({ model: 'gpt-4o', messages })
    ).rejects.toMatchObject({ name: 'ProviderError', code });
  });

  // A dialect reads the answer in the light of the request: it has to see
  // the one actually sent, not the one built before adaptation.
  it('hands the dialect the request as sent', async () => {
    mockFetch
      .mockResolvedValueOnce(refusal('response_format'))
      .mockResolvedValueOnce(reply(chatResponse));
    const parse = jest.spyOn(provider, '_parseResponse');

    await provider.chatComplete({
      model: 'gpt-4o',
      messages,
      responseFormat: { type: 'json_object' },
    });

    expect(sentBody(0)).toHaveProperty('response_format');
    expect(sentBody(1)).not.toHaveProperty('response_format');
    expect(parse.mock.calls[0][1]).not.toHaveProperty('response_format');
  });
});

// On Azure the deployment and the api-version live in the URL, and the
// `model` value may be the same for two deployments running different models.
// What one learns must not be applied to the other.
describe('learned quirks on Azure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quirksCache.clear();
  });

  function azure(deployment) {
    return new AzureOpenAIProvider({
      provider: 'azure_openai',
      apiKey: 'azure-key',
      apiHost: 'https://shared.openai.azure.com',
      config: { deployment },
    });
  }

  it('keeps two deployments on one resource apart', async () => {
    mockFetch
      .mockResolvedValueOnce(refusal('max_tokens'))
      .mockResolvedValueOnce(reply(chatResponse))
      .mockResolvedValueOnce(reply(chatResponse));

    await azure('runs-gpt-5').chatComplete({
      model: 'chat',
      messages,
      maxTokens: 100,
    });
    await azure('runs-gpt-4o').chatComplete({
      model: 'chat',
      messages,
      maxTokens: 100,
    });

    expect(sentBody(1)).toHaveProperty('max_completion_tokens', 100);
    // Untouched: nothing was learned about this deployment.
    expect(sentBody(2)).toHaveProperty('max_tokens', 100);
    expect(sentBody(2)).not.toHaveProperty('max_completion_tokens');
  });
});

// Their refusals are not worded like OpenAI's. Inheriting the OpenAI
// detection matched nothing only by luck of the error shape.
describe.each([
  [
    'AnthropicProvider',
    () => new AnthropicProvider({ provider: 'anthropic', apiKey: 'k' }),
  ],
  [
    'GeminiProvider',
    () => new GeminiProvider({ provider: 'gemini', apiKey: 'k' }),
  ],
])('%s', (_name, build) => {
  it('never adapts, even on an OpenAI-shaped refusal', () => {
    const body = {
      error: {
        message:
          "Unsupported parameter: 'temperature' is not supported with this model.",
        param: 'temperature',
        code: 'unsupported_parameter',
      },
    };

    expect(build()._detectParamQuirk(400, body, body.error.message)).toBe(null);
  });
});
