'use strict';

const _ = require('lodash');
const { blockTexts, blockLinks } = require('../exported-content');
const { getSubject, getPreheader } = require('../copy-fields');

// Personalization delimiters of the ESPs our clients use. A tag opened and
// never closed is sent as is: "Hello {{first_name," reaches the recipient.
const PAIRS = [
  ['{{', '}}'],
  ['*|', '|*'],
  ['[[', ']]'],
  ['<%', '%>'],
];
const EXCERPT_RADIUS = 25;

const count = (text, token) => text.split(token).length - 1;

/**
 * The first delimiter left unbalanced in a text, or null.
 * @returns {string|null}
 */
function unbalancedToken(text) {
  const pair = PAIRS.find(([open, close]) => count(text, open) !== count(text, close));
  if (pair) {
    return count(text, pair[0]) > count(text, pair[1]) ? pair[0] : pair[1];
  }
  return count(text, '%%') % 2 ? '%%' : null;
}

function excerptAround(text, token) {
  const at = text.indexOf(token);
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(text.length, at + token.length + EXCERPT_RADIUS);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

module.exports = {
  id: 'merge-tags',
  category: 'copy',
  severity: 'error',
  titleKey: 'Personalization tags',
  passKey: 'Every personalization tag is closed',
  unbalancedToken,
  run(ctx) {
    const texts = blockTexts(ctx);
    const links = _.groupBy(blockLinks(ctx), 'blockId');
    const sources = ctx.blocks.map((block) => ({
      blockId: block.id,
      where: 'block',
      text: [texts[block.id] || '']
        .concat((links[block.id] || []).map((link) => link.href))
        .join(' '),
    }));
    const subject = getSubject(ctx.viewModel);
    if (subject) sources.push({ blockId: null, where: 'subject', text: subject });
    const preheader = getPreheader(ctx.viewModel);
    if (preheader && preheader.value) {
      sources.push({ blockId: null, where: 'preheader', text: preheader.value });
    }

    return sources
      .map((source) => ({ ...source, token: unbalancedToken(source.text) }))
      .filter((source) => source.token)
      .map((source) => ({
        messageKey: {
          block: 'Personalization tag not closed (__token__): __excerpt__',
          subject: 'Personalization tag not closed in the subject (__token__): __excerpt__',
          preheader:
            'Personalization tag not closed in the preheader (__token__): __excerpt__',
        }[source.where],
        params: {
          token: source.token,
          excerpt: excerptAround(source.text, source.token),
        },
        blockId: source.blockId,
        propertyPath: source.where === 'block' ? null : source.where,
        value: source.text,
      }));
  },
};
