'use strict';

const OpenAICompatibleProvider = require('./openai-compatible-provider');

// Sovereign French hosting, OpenAI-compatible API.
//
// TODO(verify): confirm this origin against the OVHcloud AI Endpoints docs
// before the first customer is pointed at it — these endpoints have moved
// before, and nobody here has an account to check against.
const DEFAULT_API_HOST = 'https://oai.endpoints.kepler.ai.cloud.ovh.net';

/** OVHcloud AI Endpoints. */
class OvhProvider extends OpenAICompatibleProvider {
  _getDefaultApiHost() {
    return DEFAULT_API_HOST;
  }
}

module.exports = OvhProvider;
