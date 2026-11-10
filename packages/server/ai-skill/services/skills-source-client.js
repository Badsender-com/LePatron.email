'use strict';

/**
 * How a copy reads production (ADR 0019): production's address and the read
 * token production gave it, both in the copy's configuration
 * (`SKILLS_SOURCE_URL`, `SKILLS_SOURCE_TOKEN`), never in its database nor in
 * a page. The call goes through the guarded outbound fetch: https only, no
 * private address, no redirect followed, the answer bounded in size and time.
 * A copy follows production every night only when its configuration says so
 * (`SKILLS_SOURCE_NIGHTLY`).
 */

const config = require('../../node.config.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  guardedFetch,
  toProviderError,
} = require('../../integration-providers/provider-http.js');
const {
  PROVIDER_ERROR_CODES,
} = require('../../integration-providers/provider-error.js');

const EXPORT_PATH = '/api/skills-source/export';
// Some sixty items weigh well under a megabyte; ten leave room to grow.
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 30 * 1000;

// The code of each reason a follow writes nothing.
const CODES = {
  not_configured: ERROR_CODES.SKILLS_FOLLOW_NOT_CONFIGURED,
  invalid_address: ERROR_CODES.SKILLS_FOLLOW_INVALID_ADDRESS,
  unreachable: ERROR_CODES.SKILLS_FOLLOW_UNREACHABLE,
  token_refused: ERROR_CODES.SKILLS_FOLLOW_TOKEN_REFUSED,
  production_error: ERROR_CODES.SKILLS_FOLLOW_PRODUCTION_ERROR,
  unreadable: ERROR_CODES.SKILLS_FOLLOW_UNREADABLE,
};

// An error that says why in a word and a code the page translates (`reason`,
// `code`), and in a sentence the logs keep (`message`): never the token.
function followError(reason, message) {
  return Object.assign(new Error(message), { reason, code: CODES[reason] });
}

function sourceOf() {
  const { url, token } = config.skillsSource || {};
  return url && token ? { url, token } : null;
}

/** Whether this instance is a copy that may follow production. */
const isConfigured = () => !!sourceOf();

/** Whether this copy follows production every night too. */
const isNightly = () =>
  isConfigured() && String((config.skillsSource || {}).nightly) === 'true';

/**
 * Production's address, as the page may show it: its origin only.
 *
 * @returns {string|null}
 */
function productionOrigin() {
  const source = sourceOf();
  if (!source) return null;
  try {
    return new URL(source.url).origin;
  } catch (err) {
    return null;
  }
}

// The export route of production, refused unless it is https.
function exportUrlOf(source) {
  let base;
  try {
    base = new URL(source.url);
  } catch (err) {
    throw followError(
      'invalid_address',
      "Production's address is not a valid URL."
    );
  }
  if (base.protocol !== 'https:') {
    throw followError(
      'invalid_address',
      "Production's address must use https."
    );
  }
  return new URL(EXPORT_PATH, base.origin).toString();
}

/**
 * Production's answer, read whole. The error says what went wrong, never
 * the token.
 *
 * @returns {Promise<Object>}
 */
async function fetchProductionExport() {
  const source = sourceOf();
  if (!source) {
    throw followError('not_configured', 'This instance follows no production.');
  }
  const url = exportUrlOf(source);
  let response;
  try {
    response = await guardedFetch(url, {
      headers: {
        Authorization: `Bearer ${source.token}`,
        Accept: 'application/json',
      },
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      label: 'Production',
    });
  } catch (err) {
    throw followError('unreachable', err.message);
  }
  if (response.status === 401) {
    throw followError('token_refused', 'Production refused the read token.');
  }
  if (!response.ok) {
    throw followError(
      'production_error',
      `Production answered ${response.status}.`
    );
  }
  try {
    return await response.json();
  } catch (err) {
    // An answer too big or too slow, as much as one that is not JSON.
    const { message, code } = toProviderError(err, 'Production');
    throw followError(
      code === PROVIDER_ERROR_CODES.TIMEOUT ? 'unreachable' : 'unreadable',
      message
    );
  }
}

module.exports = {
  isConfigured,
  isNightly,
  productionOrigin,
  fetchProductionExport,
};
