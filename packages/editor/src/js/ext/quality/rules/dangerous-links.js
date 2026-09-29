'use strict';

const _ = require('lodash');
const { checkableLinks } = require('../resources');

// Links Google Web Risk lists as phishing, malware or unwanted software,
// asked by the server (quality-web-risk.service.js). Runs only where the
// platform configured a Web Risk key.
const webRisk = (ctx) => _.get(ctx, 'remote.webRisk', null);

// The worst first: what the message names.
const MESSAGES = [
  ['SOCIAL_ENGINEERING', 'Google lists this link as phishing: __label__'],
  ['MALWARE', 'Google lists this link as malware: __label__'],
  ['UNWANTED_SOFTWARE', 'Google lists this link as unwanted software: __label__'],
];

function messageOf(types) {
  const found = MESSAGES.find(([type]) => types.includes(type));
  return found ? found[1] : 'Google lists this link as unsafe: __label__';
}

module.exports = {
  id: 'dangerous-links',
  category: 'content',
  severity: 'error',
  titleKey: 'Dangerous links',
  remote: true,
  optional: true,
  passKey: 'Google lists none of the links as dangerous',
  enabled: (ctx) => Boolean(webRisk(ctx) && webRisk(ctx).enabled),
  run(ctx) {
    const threats = webRisk(ctx).threats || {};
    return checkableLinks(ctx)
      .filter((link) => threats[link.href])
      .map((link) => ({
        messageKey: messageOf(threats[link.href]),
        params: { label: link.text || link.href },
        blockId: link.blockId,
        value: link.href,
      }));
  },
};
