'use strict';

const OpenAICompatibleProvider = require('./openai-compatible-provider');
const { PROVIDER_ERROR_CODES: CODES } = require('../provider-error.js');

// Sovereign French hosting, OpenAI-compatible API. Origin confirmed by call:
// it answers 403 with an authentication message, where the other candidates
// do not resolve at all.
const DEFAULT_API_HOST = 'https://oai.endpoints.kepler.ai.cloud.ovh.net';

/** OVHcloud AI Endpoints. */
class OvhProvider extends OpenAICompatibleProvider {
  _getDefaultApiHost() {
    return DEFAULT_API_HOST;
  }

  /**
   * An invalid key answers 403 here, not 401 — verified by calling it. Left to
   * the OpenAI default it would surface as a generic API error, sending the
   * admin looking anywhere but at the key they just pasted.
   */
  _mapErrorToCode(status, errorData) {
    if (status === 403) return CODES.INVALID_CREDENTIALS;
    return super._mapErrorToCode(status, errorData);
  }
}

module.exports = OvhProvider;
