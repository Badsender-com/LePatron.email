'use strict';

const OpenAICompatibleProvider = require('./openai-compatible-provider');

// Sovereign French hosting, OpenAI-compatible API. Origin confirmed by call:
// it answers 403 with an authentication message, where the other candidates
// do not resolve at all.
const DEFAULT_API_HOST = 'https://oai.endpoints.kepler.ai.cloud.ovh.net';

/**
 * OVHcloud AI Endpoints.
 *
 * Nothing but the host: the dialect, the 403 reading and the "a model name is
 * required" rule all come from OpenAICompatibleProvider.
 */
class OvhProvider extends OpenAICompatibleProvider {
  _getDefaultApiHost() {
    return DEFAULT_API_HOST;
  }
}

module.exports = OvhProvider;
