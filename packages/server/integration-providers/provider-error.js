'use strict';

const PROVIDER_ERROR_CODES = Object.freeze({
  INVALID_CREDENTIALS: 'PROVIDER_INVALID_CREDENTIALS',
  // Credits, billing or a hard quota exhausted: someone has to act.
  QUOTA_EXCEEDED: 'PROVIDER_QUOTA_EXCEEDED',
  // Too many requests for now: the same call succeeds a little later.
  RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  TIMEOUT: 'PROVIDER_TIMEOUT',
  API_ERROR: 'PROVIDER_API_ERROR',
  INVALID_RESPONSE: 'PROVIDER_INVALID_RESPONSE',
  // The answer stopped at the output token ceiling: what came back is a
  // prefix, and a smaller request would fit where retrying the same would not.
  OUTPUT_TRUNCATED: 'PROVIDER_OUTPUT_TRUNCATED',
  CONFIG_ERROR: 'PROVIDER_CONFIG_ERROR',
});

const HTTP_STATUS_BY_CODE = {
  [PROVIDER_ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [PROVIDER_ERROR_CODES.QUOTA_EXCEEDED]: 429,
  [PROVIDER_ERROR_CODES.RATE_LIMITED]: 429,
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
