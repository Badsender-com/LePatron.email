'use strict';

const OpenAICompatibleProvider = require('./openai-compatible-provider');

// Sovereign French hosting, OpenAI-compatible API. An account scoped to a
// project overrides this through apiHost.
const DEFAULT_API_HOST = 'https://api.scaleway.ai';

/** Scaleway Generative APIs. */
class ScalewayProvider extends OpenAICompatibleProvider {
  _getDefaultApiHost() {
    return DEFAULT_API_HOST;
  }
}

module.exports = ScalewayProvider;
