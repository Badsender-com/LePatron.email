'use strict';

const PROVIDER_ERROR_CODES = Object.freeze({
  INVALID_CREDENTIALS: 'PROVIDER_INVALID_CREDENTIALS',
  QUOTA_EXCEEDED: 'PROVIDER_QUOTA_EXCEEDED',
  TIMEOUT: 'PROVIDER_TIMEOUT',
  API_ERROR: 'PROVIDER_API_ERROR',
  INVALID_RESPONSE: 'PROVIDER_INVALID_RESPONSE',
  CONFIG_ERROR: 'PROVIDER_CONFIG_ERROR',
});

const HTTP_STATUS_BY_CODE = {
  [PROVIDER_ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [PROVIDER_ERROR_CODES.QUOTA_EXCEEDED]: 429,
  [PROVIDER_ERROR_CODES.TIMEOUT]: 504,
  [PROVIDER_ERROR_CODES.CONFIG_ERROR]: 400,
};

class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }

  get httpStatus() {
    return HTTP_STATUS_BY_CODE[this.code] || 502;
  }
}

module.exports = { ProviderError, PROVIDER_ERROR_CODES };
