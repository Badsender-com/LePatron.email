'use strict';

// Regression test for the apiKey-leak hardening (CWE-200). The integration
// document carries a decrypted apiKey in memory and mongoose-hidden only masks
// toJSON() (autoHideObject:false), so the response MUST be built from an
// explicit whitelist. This pins that the DTO never exposes the key, even when
// fed a raw object or a doc-like object whose toObject() returns the key.

const {
  toIntegrationDto,
} = require('../../../packages/server/integration/integration.controller.js');

const SECRET = 'sk-super-secret-api-key-value-1234567890';

describe('toIntegrationDto (apiKey never leaks)', () => {
  it('omits apiKey from a plain object', () => {
    const dto = toIntegrationDto({
      _id: 'id1',
      name: 'Prod',
      type: 'ai',
      provider: 'openai',
      apiHost: 'https://api.openai.com',
      apiKey: SECRET,
      isActive: true,
    });

    expect(JSON.stringify(dto)).not.toContain(SECRET);
    expect(dto.apiKey).toBeUndefined();
    expect(dto.name).toBe('Prod');
    expect(dto.provider).toBe('openai');
  });

  it('omits apiKey even when toObject() exposes it (Mongoose doc)', () => {
    const docLike = {
      toObject: () => ({
        _id: 'id2',
        name: 'Self-hosted',
        type: 'ai',
        provider: 'mistral',
        apiHost: 'https://llm.internal',
        apiKey: SECRET,
        validationStatus: 'valid',
      }),
    };

    const dto = toIntegrationDto(docLike);

    expect(JSON.stringify(dto)).not.toContain(SECRET);
    expect(dto.apiKey).toBeUndefined();
    expect(dto.validationStatus).toBe('valid');
  });

  it('passes through nullish input', () => {
    expect(toIntegrationDto(null)).toBe(null);
    expect(toIntegrationDto(undefined)).toBe(undefined);
  });
});
