'use strict';

const OpenAICompatibleProvider = require('./openai-compatible-provider');
const { PROVIDER_ERROR_CODES: CODES } = require('../provider-error.js');

// Sovereign French hosting, OpenAI-compatible API. An account scoped to a
// project overrides this through apiHost.
const DEFAULT_API_HOST = 'https://api.scaleway.ai';

/** Scaleway Generative APIs. */
class ScalewayProvider extends OpenAICompatibleProvider {
  _getDefaultApiHost() {
    return DEFAULT_API_HOST;
  }

  /** Same as OVHcloud: an invalid key answers 403, verified by calling it. */
  _mapErrorToCode(status, errorData) {
    if (status === 403) return CODES.INVALID_CREDENTIALS;
    return super._mapErrorToCode(status, errorData);
  }
}

module.exports = ScalewayProvider;
