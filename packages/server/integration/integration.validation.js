'use strict';

const { BadRequest } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const IntegrationTypes = require('../constant/integration-type.js');
const {
  assertOutboundHostAllowed,
  OUTBOUND_HOST_ERRORS,
} = require('../utils/outbound-host.js');
const { MODEL_ID_PATTERN } = require('../ai-feature/ai-feature.validation.js');

module.exports = {
  normalizeProductId,
  assertApiKeyResent,
  validateIntegrationConfig,
  validateApiHost,
  isHostChange,
};

// Infomaniak builds its base URL from productId (`/1/ai/{productId}/openai`),
// so anything but its numeric id reshapes the path the API key is sent to:
// `../../2/profile?x=` reaches another endpoint of api.infomaniak.com.
const PRODUCT_ID_PATTERN = /^\d{1,20}$/;

/**
 * Trim and validate a productId. Empty means "none": null, so that clearing
 * the field clears the value instead of storing ''.
 */
function normalizeProductId(productId) {
  if (productId === undefined || productId === null) return productId;
  const trimmed = String(productId).trim();
  if (trimmed === '') return null;
  if (!PRODUCT_ID_PATTERN.test(trimmed)) {
    throw new BadRequest(ERROR_CODES.INVALID_PRODUCT_ID);
  }
  return trimmed;
}

const sameHost = (a, b) => (a || null) === (b || null);

/** Whether an update points the integration at a different host. */
function isHostChange({ integration, apiHost }) {
  return apiHost !== undefined && !sameHost(apiHost, integration.apiHost);
}

// Types that send a secret to their host: an AI key with every call, a signed
// Metabase token in every embed URL. Over http both travel in clear, and can
// be read or altered on the way. A public RSS feed sends nothing, and many are
// still served over http.
const HTTPS_ONLY_TYPES = [IntegrationTypes.AI, IntegrationTypes.DASHBOARD];

/**
 * Check a host before it is saved: allowed scheme, public address (SSRF
 * guard), and https for the types that send a secret.
 *
 * Metabase already refused http when embedding; accepting it here saved an
 * integration that could never display, behind a generic 500.
 *
 * @param {string} apiHost
 * @param {Object} options
 * @param {string} options.type integration type
 * @throws {BadRequest} with the reason, so the form can say what to fix
 */
async function validateApiHost(apiHost, { type } = {}) {
  if (!apiHost) return;
  try {
    await assertOutboundHostAllowed(apiHost);
  } catch (error) {
    // A private address is the one refusal an admin can neither guess nor fix
    // by retrying: it is a deliberate rule, not a mistake in what they typed.
    if (error.code === OUTBOUND_HOST_ERRORS.PRIVATE_ADDRESS) {
      throw new BadRequest(ERROR_CODES.INTEGRATION_HOST_NOT_PUBLIC);
    }
    if (error.code === OUTBOUND_HOST_ERRORS.DNS_FAILED) {
      throw new BadRequest(ERROR_CODES.INTEGRATION_HOST_UNREACHABLE);
    }
    throw new BadRequest(ERROR_CODES.INTEGRATION_HOST_INVALID);
  }

  // After the SSRF guard, not before: `http://127.0.0.1` is refused as a
  // private address, which switching to https would not fix.
  if (
    HTTPS_ONLY_TYPES.includes(type) &&
    new URL(apiHost).protocol !== 'https:'
  ) {
    throw new BadRequest(ERROR_CODES.INTEGRATION_HOST_HTTPS_REQUIRED);
  }
}

/**
 * Refuse to point a stored key at a new destination without the key itself.
 *
 * The stored key is decrypted and sent with every call, to whatever host the
 * integration names. Letting an update change the host or the provider alone
 * meant any admin of the group could send a key someone else entered — one
 * they cannot read on screen — to a server of their own. Asking for the key
 * again closes that: whoever redirects it must already know it.
 *
 * Only when a key is stored: without one (a public RSS feed) there is nothing
 * to send.
 */
function assertApiKeyResent({ integration, provider, apiHost, apiKey }) {
  if (!integration.apiKey || apiKey) return;

  const providerChanged =
    provider !== undefined && provider !== integration.provider;

  if (providerChanged || isHostChange({ integration, apiHost })) {
    throw new BadRequest(ERROR_CODES.INTEGRATION_API_KEY_REQUIRED);
  }
}

// What each kind of `config` value may look like. Deployment names and API
// versions end up in the request path and query, so they get a shape, not a
// free string: `..` as a deployment walked up a segment of the Azure path.
const CONFIG_VALUE_CHECKS = {
  model: (value) => typeof value === 'string' && MODEL_ID_PATTERN.test(value),
  // Azure allows letters, digits, `-`, `_` and `.`, 64 characters at most.
  deployment: (value) =>
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value),
  apiVersion: (value) =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(-preview)?$/.test(value),
  boolean: (value) => typeof value === 'boolean',
};

const OPENAI_COMPATIBLE_CONFIG = {
  model: 'model',
  supportsJsonMode: 'boolean',
};

// The keys each provider reads from `config`, and their kind. `config` is a
// Mixed field written as sent: without this, any key of any shape was
// persisted and read back by the provider.
const CONFIG_FIELDS_BY_PROVIDER = {
  openai: { model: 'model' },
  mistral: { model: 'model' },
  infomaniak: { model: 'model' },
  anthropic: { model: 'model' },
  gemini: { model: 'model' },
  azure_openai: {
    model: 'model',
    deployment: 'deployment',
    apiVersion: 'apiVersion',
    reasoningModel: 'boolean',
  },
  openai_compatible: OPENAI_COMPATIBLE_CONFIG,
  scaleway: OPENAI_COMPATIBLE_CONFIG,
  ovh: OPENAI_COMPATIBLE_CONFIG,
};

/**
 * Check an integration `config` against what its provider reads.
 *
 * Unknown keys are refused rather than dropped: dropping silently is how
 * productId went missing, and a typo would otherwise answer 200.
 *
 * @param {string} provider
 * @param {*} config
 * @returns {Object} the config to store (`{}` when none was sent)
 * @throws {BadRequest} INTEGRATION_CONFIG_INVALID
 */
function validateIntegrationConfig(provider, config) {
  if (config === undefined || config === null) return {};
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new BadRequest(ERROR_CODES.INTEGRATION_CONFIG_INVALID);
  }

  const fields = CONFIG_FIELDS_BY_PROVIDER[provider] || {};
  for (const [key, value] of Object.entries(config)) {
    const kind = fields[key];
    if (!kind) throw new BadRequest(ERROR_CODES.INTEGRATION_CONFIG_INVALID);
    // null clears the setting.
    if (value !== null && !CONFIG_VALUE_CHECKS[kind](value)) {
      throw new BadRequest(ERROR_CODES.INTEGRATION_CONFIG_INVALID);
    }
  }
  return config;
}
