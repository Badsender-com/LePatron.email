'use strict';

/**
 * How a copy reads production (ADR 0019): production's address and the read
 * token production gave it, both in the copy's configuration
 * (`SKILLS_SOURCE_URL`, `SKILLS_SOURCE_TOKEN`), never in its database nor in
 * a page. The call goes through the guarded outbound fetch: https only, no
 * private address, no redirect followed, the answer bounded in size and time.
 */

const config = require('../../node.config.js');
const {
  guardedFetch,
} = require('../../integration-providers/provider-http.js');

const EXPORT_PATH = '/api/skills-source/export';
// Some sixty items weigh well under a megabyte; ten leave room to grow.
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 30 * 1000;

function sourceOf() {
  const { url, token } = config.skillsSource || {};
  return url && token ? { url, token } : null;
}

/** Whether this instance is a copy that may follow production. */
const isConfigured = () => !!sourceOf();

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
    throw new Error("Production's address is not a valid URL.");
  }
  if (base.protocol !== 'https:') {
    throw new Error("Production's address must use https.");
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
  if (!source) throw new Error('This instance follows no production.');
  const response = await guardedFetch(exportUrlOf(source), {
    headers: {
      Authorization: `Bearer ${source.token}`,
      Accept: 'application/json',
    },
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    label: 'Production',
  });
  if (response.status === 401) {
    throw new Error('Production refused the read token.');
  }
  if (!response.ok) {
    throw new Error(`Production answered ${response.status}.`);
  }
  try {
    return await response.json();
  } catch (err) {
    throw new Error('Production answered something that is not JSON.');
  }
}

module.exports = { isConfigured, productionOrigin, fetchProductionExport };
