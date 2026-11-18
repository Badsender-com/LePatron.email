'use strict';

const _ = require('lodash');
const { checkableLinks } = require('../resources');

// Links Google Web Risk lists as phishing, malware or unwanted software,
// asked by the server (quality-web-risk.service.js). Runs only where the
// platform configured a Web Risk key.
const webRisk = (ctx) => _.get(ctx, 'remote.webRisk', null);

// The links Google could not be asked about (a revoked key, a spent budget,
// out of time): they are not "clean".
const unchecked = (ctx) => new Set(_.get(webRisk(ctx), 'unchecked', []));

// The worst first: what the message names.
const MESSAGES = [
  ['SOCIAL_ENGINEERING', 'Google lists this link as phishing: __label__'],
  ['MALWARE', 'Google lists this link as malware: __label__'],
  [
    'UNWANTED_SOFTWARE',
    'Google lists this link as unwanted software: __label__',
  ],
];

function messageOf(types) {
  const found = MESSAGES.find(([type]) => types.includes(type));
  return found ? found[1] : 'Google lists this link as unsafe: __label__';
}

function finding(link, types) {
  return types
    ? {
        messageKey: messageOf(types),
        params: { label: link.text || link.href },
        blockId: link.blockId,
        value: link.href,
      }
    : {
        severity: 'info',
        messageKey:
          'Google could not check this link, check it by hand: __label__',
        params: { label: link.text || link.href },
        blockId: link.blockId,
        // Ignoring "could not check" must not hide a later listing.
        value: `unchecked|${link.href}`,
      };
}

module.exports = {
  id: 'dangerous-links',
  category: 'content',
  severity: 'error',
  titleKey: 'Dangerous links',
  remote: true,
  optional: true,
  passKey: 'Google lists none of the links as dangerous',
  enabled(ctx) {
    if (!webRisk(ctx) || !webRisk(ctx).enabled) return false;
    // Google answered for none of the links: the check did not run.
    const links = checkableLinks(ctx);
    const skipped = unchecked(ctx);
    return !(links.length > 0 && links.every((l) => skipped.has(l.href)));
  },
  run(ctx) {
    const threats = webRisk(ctx).threats || {};
    const skipped = unchecked(ctx);
    return checkableLinks(ctx)
      .filter((link) => threats[link.href] || skipped.has(link.href))
      .map((link) => finding(link, threats[link.href]));
  },
};
