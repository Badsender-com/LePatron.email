'use strict';

// Maintained lists behind the link checks. Keep them short and sourced: a
// false positive costs the client's trust in every other check.

// Public URL shorteners: their shared domains carry everyone's reputation, and
// filters distrust them. A shortener on the brand's own domain is fine.
const PUBLIC_SHORTENERS = new Set([
  'bit.ly',
  'bitly.com',
  'buff.ly',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'ow.ly',
  'rb.gy',
  'rebrand.ly',
  's.id',
  'shorturl.at',
  't.co',
  'tiny.cc',
  'tinyurl.com',
]);

// Top-level domains most abused for spam and phishing (Spamhaus TLD statistics).
// A legitimate brand rarely sends from them.
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
  'xyz',
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
