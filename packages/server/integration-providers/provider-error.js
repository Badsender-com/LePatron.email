'use strict';

class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

const PROVIDER_ERROR_CODES = Object.freeze({
  INVALID_CREDENTIALS: 'PROVIDER_INVALID_CREDENTIALS',
  QUOTA_EXCEEDED: 'PROVIDER_QUOTA_EXCEEDED',
  TIMEOUT: 'PROVIDER_TIMEOUT',
  API_ERROR: 'PROVIDER_API_ERROR',
  INVALID_RESPONSE: 'PROVIDER_INVALID_RESPONSE',
  CONFIG_ERROR: 'PROVIDER_CONFIG_ERROR',
});

module.exports = { ProviderError, PROVIDER_ERROR_CODES };
