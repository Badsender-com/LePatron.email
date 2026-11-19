'use strict';

const createError = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { RESOURCES } = require('../../shared/quality/limits.js');
const { SERVER_TASKS } = require('../../shared/quality/checks.js');
const { PURPOSES } = require('./quality-limits.js');

// What the editor may send for the server's quality checks
// (quality-resources.service.js): bounded lists of web addresses, the checks
// it wants, and the count the run goes to. Anything else is refused before
// anything is read or fetched.

const MAX_LINKS = RESOURCES.maxLinks;
const MAX_IMAGES = RESOURCES.maxImages;
const MAX_URL_LENGTH = RESOURCES.maxUrlLength;

// The editor's checks this run serves, and what each has the server do: visit
// the links, ask Web Risk, ask the blocklists, download the images. Each check
// of the shared catalogue says it, a local one with a second look included.
const REMOTE_CHECKS = SERVER_TASKS;

function invalid() {
  return new createError.UnprocessableEntity(
    ERROR_CODES.INVALID_QUALITY_RESOURCES
  );
}

function checkUrl(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) {
    throw invalid();
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch (e) {
    throw invalid();
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalid();
  }
  // As sent, credentials included: the editor finds its results back by the
  // address it asked for. What is fetched is `withoutCredentials(value)`.
  return value;
}

function checkIds(value) {
  if (!Array.isArray(value)) throw invalid();
  value.forEach((id) => {
    if (typeof id !== 'string' || !Object.hasOwn(REMOTE_CHECKS, id)) {
      throw invalid();
    }
  });
  return [...new Set(value)];
}

const PAYLOAD_KEYS = ['links', 'images', 'checks', 'purpose'];

function checkPurpose(value) {
  if (!PURPOSES.includes(value)) throw invalid();
  return value;
}

/**
 * @param {Object} body - `{ links: string[], images: [{ url }], checks?,
 *   purpose? }`, `checks` the editor's checks that are on among
 *   REMOTE_CHECKS, `purpose` the count the run goes to (quality-limits.js)
 * @returns {{ links: string[], images: string[], checks?: string[],
 *   purpose?: string }} distinct, bounded; `checks` and `purpose` only when
 *   sent
 * @throws 422 INVALID_QUALITY_RESOURCES on anything else
 */
function validateResourcesPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const keys = Object.keys(body);
  if (keys.some((key) => !PAYLOAD_KEYS.includes(key))) throw invalid();
  const links = body.links || [];
  const images = body.images || [];
  if (!Array.isArray(links) || !Array.isArray(images)) throw invalid();
  if (links.length > MAX_LINKS || images.length > MAX_IMAGES) throw invalid();
  const checks =
    body.checks === undefined ? {} : { checks: checkIds(body.checks) };
  const purpose =
    body.purpose === undefined ? {} : { purpose: checkPurpose(body.purpose) };
  return {
    ...checks,
    ...purpose,
    links: [...new Set(links.map(checkUrl))],
    images: [
      ...new Set(
        images.map((image) => {
          if (!image || typeof image !== 'object') throw invalid();
          return checkUrl(image.url);
        })
      ),
    ],
  };
}

module.exports = {
  validateResourcesPayload,
  REMOTE_CHECKS,
  MAX_LINKS,
  MAX_IMAGES,
};
