'use strict';

const { zipObject } = require('lodash');

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
const DAY_MS = 24 * 60 * 60 * 1000;

async function checkDomains(links, zones, key, run, deps) {
  if (!zones.length) return { enabled: false, listed: {} };
  const domains = [
    ...new Set(links.map(blocklists.registrableDomain).filter(Boolean)),
  ];
  const results = await mapLimited(domains, CONCURRENCY, (domain) =>
    // Past the run's deadline, a domain is not judged (and not cached).
    Date.now() > run.deadline
      ? Promise.resolve([])
      : cached(
          key('dnsbl', domain),
          () => blocklists.listedOn(domain, zones, deps.resolve4),
          () => true
        )
  );
  const listed = zipObject(domains, results);
  Object.keys(listed).forEach((domain) => {
    if (!listed[domain].length) delete listed[domain];
  });
  return { enabled: true, listed };
}

const webRiskLookups = new Map(); // cacheScope -> { since, count }

// Takes one lookup from the company's daily budget; false once it is spent.
function spendWebRiskLookup(scope) {
  const now = Date.now();
  const budget = webRiskLookups.get(scope);
  if (!budget || now - budget.since > DAY_MS) {
    webRiskLookups.set(scope, { since: now, count: 1 });
    return true;
  }
  if (budget.count >= WEB_RISK_LOOKUPS_PER_DAY) return false;
  budget.count += 1;
  return true;
}

// One lookup per host and path: Google canonicalises the query string too,
// and could list one of `?utm_content=1`, `?utm_content=2`… alone, but an
// email's tagged links differ only there, and each lookup costs. A compromise.
function webRiskKeyOf(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

// Links Google lists as phishing, malware or unwanted software. A failed
// lookup, one past the run's deadline or past the company's daily budget is
// not judged, and not kept for the next runs.
async function checkThreats(links, apiKey, key, run, scope, deps) {
  if (!apiKey) return { enabled: false, threats: {} };
  const results = await mapLimited(links, CONCURRENCY, (url) =>
    cached(
      key('webrisk', webRiskKeyOf(url)),
      () => {
        if (Date.now() > run.deadline || !spendWebRiskLookup(scope)) {
          return Promise.resolve(null);
        }
        return deps.webRiskLookup(withoutCredentials(url), apiKey, {
          timeoutMs: timeLeft(run, webRisk.TIMEOUT_MS),
        });
      },
      (types) => types !== null
    )
  );
  const threats = zipObject(links, results);
  Object.keys(threats).forEach((url) => {
    if (!threats[url] || !threats[url].length) delete threats[url];
  });
  return { enabled: true, threats };
}

function clearBudgetsForTests() {
  webRiskLookups.clear();
}

module.exports = {
  checkDomains,
  checkThreats,
  WEB_RISK_LOOKUPS_PER_DAY,
  clearBudgetsForTests,
};
