'use strict';

const fetch = require('node-fetch');

const config = require('../node.config.js');
const logger = require('../utils/logger.js');

/**
 * Google Web Risk (the commercial Safe Browsing), for the quality check on
 * dangerous links: phishing, malware, unwanted software.
 * https://cloud.google.com/web-risk/docs/lookup-api
 *
 * Off unless `QC_WEB_RISK_API_KEY` holds an API key of a Google Cloud project
 * with the Web Risk API enabled. The first 100,000 lookups of a month are
 * free, then $0.50 per 1,000; a quality run asks about 60 links at most,
 * answers are cached, and a company has a daily budget of lookups
 * (quality-resources.service.js).
 */

const ENDPOINT = 'https://webrisk.googleapis.com/v1/uris:search';
const THREAT_TYPES = ['SOCIAL_ENGINEERING', 'MALWARE', 'UNWANTED_SOFTWARE'];
const TIMEOUT_MS = 4000;

const apiKey = (
  value = config.qualityControl && config.qualityControl.webRiskApiKey
) => (value || '').trim() || null;

// The key travels in a header, never in the URL: a proxy or an outbound log
// records URLs.
function lookupUrl(url) {
  const params = new URLSearchParams();
  THREAT_TYPES.forEach((type) => params.append('threatTypes', type));
  params.append('uri', url);
  return `${ENDPOINT}?${params.toString()}`;
}

/**
 * @param {string} url
 * @param {string} key
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - never past the run's deadline
 * @returns {Promise<string[]|null>} the threat types Google lists the address
 *   under ([] when none), or null when the lookup failed: not judged
 */
async function lookup(
  url,
  key,
  { timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}
) {
  try {
    const response = await fetchImpl(lookupUrl(url), {
      headers: { 'X-Goog-Api-Key': key },
      redirect: 'error',
      timeout: Math.min(TIMEOUT_MS, timeoutMs),
      size: 64 * 1024,
    });
    if (!response.ok) {
      logger.warn('[QUALITY] Web Risk lookup failed', {
        status: response.status,
      });
      return null;
    }
    const body = await response.json();
    return (body && body.threat && body.threat.threatTypes) || [];
  } catch (error) {
    logger.warn('[QUALITY] Web Risk lookup failed', { error: error.name });
    return null;
  }
}

module.exports = { apiKey, lookup, lookupUrl, THREAT_TYPES, TIMEOUT_MS };
