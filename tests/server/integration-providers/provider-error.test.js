'use strict';

const {
  ProviderError,
  PROVIDER_ERROR_CODES,
} = require('../../../packages/server/integration-providers/provider-error');

describe('ProviderError', () => {
  it('should extend Error', () => {
    const error = new ProviderError('test', PROVIDER_ERROR_CODES.API_ERROR);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProviderError);
  });

  it('should set name, message and code', () => {
    const error = new ProviderError(
      'API key is invalid',
      PROVIDER_ERROR_CODES.INVALID_CREDENTIALS
    );
    expect(error.name).toBe('ProviderError');
    expect(error.message).toBe('API key is invalid');
    expect(error.code).toBe('PROVIDER_INVALID_CREDENTIALS');
  });

  it('should have a stack trace', () => {
    const error = new ProviderError('test', PROVIDER_ERROR_CODES.TIMEOUT);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ProviderError');
  });

  // Translation answers with this status: a rate limit stays a 429 there.
  it('answers 429 for a quota and for a rate limit', () => {
    const { QUOTA_EXCEEDED, RATE_LIMITED } = PROVIDER_ERROR_CODES;
    expect(new ProviderError('x', QUOTA_EXCEEDED).httpStatus).toBe(429);
    expect(new ProviderError('x', RATE_LIMITED).httpStatus).toBe(429);
  });
});

describe('PROVIDER_ERROR_CODES', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(PROVIDER_ERROR_CODES)).toBe(true);
  });

  it('should contain all expected codes', () => {
    expect(PROVIDER_ERROR_CODES).toEqual({
      INVALID_CREDENTIALS: 'PROVIDER_INVALID_CREDENTIALS',
      QUOTA_EXCEEDED: 'PROVIDER_QUOTA_EXCEEDED',
      RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
      TIMEOUT: 'PROVIDER_TIMEOUT',
      API_ERROR: 'PROVIDER_API_ERROR',
      INVALID_RESPONSE: 'PROVIDER_INVALID_RESPONSE',
      OUTPUT_TRUNCATED: 'PROVIDER_OUTPUT_TRUNCATED',
      CONFIG_ERROR: 'PROVIDER_CONFIG_ERROR',
    });
  });
});
