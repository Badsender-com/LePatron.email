'use strict';

// Maintained lists behind the link checks. Keep them short and sourced: a
// false positive costs the client's trust in every other check.

// Public URL shorteners: their shared domains carry everyone's reputation, and
// filters distrust them. A shortener on the brand's own domain is fine.
// Source: the most used public shorteners
// (https://en.wikipedia.org/wiki/URL_shortening), list compiled October 2026.
// `goo.gl` stopped resolving on 25 August 2025
// (https://developers.googleblog.com/en/google-url-shortener-links-will-no-longer-be-available/):
// a link to it is dead, and is kept here so it is still reported.
const PUBLIC_SHORTENERS = new Set([
  'bit.do',
  'bit.ly',
  'bitly.com',
  'buff.ly',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'lc.cx',
  'ow.ly',
  'rb.gy',
  'rebrand.ly',
  's.id',
  'shorturl.at',
  't.co',
  't.ly',
  'tiny.cc',
  'tinyurl.com',
  'urlz.fr',
]);

// Top-level domains most abused for spam and phishing.
// Source: Spamhaus, most abused top-level domains
// (https://www.spamhaus.org/statistics/tlds/), list compiled October 2026,
// plus `.zip` and `.mov` (file extensions sold as domains).
// `.xyz` is left out: it is in the list too, but established brands use it
// (Alphabet's abc.xyz), and a warning on their link would cost more trust
// than it earns.
const RISKY_TLDS = new Set([
  'cf',
  'click',
  'country',
  'fit',
  'ga',
  'gq',
  'loan',
  'ml',
  'mov',
  'rest',
  'tk',
  'top',
  'work',
  'zip',
]);

// Reserved for documentation (RFC 2606): never a real destination.
const EXAMPLE_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);

// Subdomain labels that name a test environment: a link left pointing at it.
const TEST_ENVIRONMENT_LABEL = /^(localhost|staging|preprod|pre-prod|recette|uat|dev|test)$/i;

module.exports = {
  PUBLIC_SHORTENERS,
  RISKY_TLDS,
  EXAMPLE_DOMAINS,
  TEST_ENVIRONMENT_LABEL,
};
