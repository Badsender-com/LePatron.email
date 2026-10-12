'use strict';

const { QualityBudgets } = require('../common/models.common.js');
const { KEEP_SPENT_SECONDS } = require('./quality-budget.schema.js');
const logger = require('../utils/logger.js');
const blocklists = require('./quality-blocklists.service.js');
const webRisk = require('./quality-web-risk.service.js');
const {
  cached,
  mapLimited,
  withoutCredentials,
  timeLeft,
  CONCURRENCY,
} = require('./quality-limits.js');

/**
 * What third parties say of the links of an email, for the quality checks
 * (quality-resources.service.js): the DNS blocklists listing a link's domain,
 * and the links Google Web Risk lists as dangerous. Both off unless
 * configured (quality-blocklists.service.js, quality-web-risk.service.js).
 */

// Web Risk lookups a company may make in a day, past the cache. A run asks
// 60 at most: this lets a company run the checks some fifty times a day, and
// bounds what one account can cost past Google's free tier.
const WEB_RISK_LOOKUPS_PER_DAY = 3000;
const WEB_RISK_KIND = 'webrisk';
// MongoDB's error for a document that breaks a unique index.
const DUPLICATE_KEY = 11000;

const UNCHECKED_DOMAIN = Object.freeze({ names: [], checked: false });

/**
 * The blocklists listing the registrable domain of each link. A domain a
 * zone could not answer for (resolver down, query refused, out of time) is
 * `unchecked`, and not kept for the next runs: "listed by none" must not be
 * taken for "clean".
 * @returns {Promise<{ enabled: boolean, listed: Object, unchecked: string[] }>}
 */
async function checkDomains(links, zones, key, run, deps) {
  if (!zones.length) return { enabled: false, listed: {}, unchecked: [] };
  const domains = [
    ...new Set(links.map(blocklists.registrableDomain).filter(Boolean)),
  ];
  const results = await mapLimited(domains, CONCURRENCY, (domain) =>
    Date.now() > run.deadline
      ? Promise.resolve(UNCHECKED_DOMAIN)
      : cached(
          key('dnsbl', domain),
          () => blocklists.listedOn(domain, zones, deps.resolve4),
          (result) => result.checked
        )
  );
  const listed = {};
  const unchecked = [];
  domains.forEach((domain, i) => {
    const { names, checked } = results[i];
    if (names.length) listed[domain] = names;
    else if (!checked) unchecked.push(domain);
  });
  return { enabled: true, listed, unchecked };
}

const dayOf = (date) => date.toISOString().slice(0, 10);

// When the day's document may go: the day after, so that it can be read.
const dayExpiry = (date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) +
      KEEP_SPENT_SECONDS * 1000
  );

/**
 * Takes one lookup from the company's daily budget; false once it is spent.
 *
 * The budget is the one thing that costs money, so it is shared by every
 * worker of the cluster, in the database: one document per company and UTC
 * day, incremented only while under the limit. Past it the filter matches
 * nothing, the upsert then runs into the day's document, and that duplicate
 * key is the answer "spent". Two workers opening the same day at once meet
 * the same error, hence one retry. Without the database, nothing is spent.
 */
async function spendWebRiskLookup(scope, now = new Date()) {
  const day = dayOf(now);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await QualityBudgets.findOneAndUpdate(
        {
          scope,
          kind: WEB_RISK_KIND,
          day,
          count: { $lt: WEB_RISK_LOOKUPS_PER_DAY },
        },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: dayExpiry(now) } },
        { upsert: true }
      );
      return true;
    } catch (error) {
      if (error.code !== DUPLICATE_KEY) {
        logger.warn('[QUALITY] Web Risk budget unavailable', {
          error: error.name,
          code: error.code,
        });
        return false;
      }
    }
  }
  return false;
}

// One lookup per host and path: Google canonicalises the query string too,
// and could list one of `?utm_content=1`, `?utm_content=2`… alone, but an
// email's tagged links differ only there, and each lookup costs. A compromise.
function webRiskKeyOf(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

/**
 * Links Google lists as phishing, malware or unwanted software. A failed
 * lookup (a revoked key, Google down), one past the run's deadline or past
 * the company's daily budget is `unchecked`, and not kept for the next runs.
 * @returns {Promise<{ enabled: boolean, threats: Object, unchecked: string[] }>}
 */
async function checkThreats(links, apiKey, key, run, scope, deps) {
  if (!apiKey) return { enabled: false, threats: {}, unchecked: [] };
  const results = await mapLimited(links, CONCURRENCY, (url) =>
    cached(
      key('webrisk', webRiskKeyOf(url)),
      async () => {
        if (Date.now() > run.deadline) return null;
        if (!(await deps.spendWebRiskLookup(scope))) return null;
        return deps.webRiskLookup(withoutCredentials(url), apiKey, {
          timeoutMs: timeLeft(run, webRisk.TIMEOUT_MS),
        });
      },
      (types) => types !== null
    )
  );
  const threats = {};
  const unchecked = [];
  links.forEach((url, i) => {
    if (results[i] === null) unchecked.push(url);
    else if (results[i].length) threats[url] = results[i];
  });
  return { enabled: true, threats, unchecked };
}

module.exports = {
  checkDomains,
  checkThreats,
  spendWebRiskLookup,
  WEB_RISK_LOOKUPS_PER_DAY,
};
