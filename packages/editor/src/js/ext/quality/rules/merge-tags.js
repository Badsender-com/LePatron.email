'use strict';

const _ = require('lodash');
const { blockLinks, textOf } = require('../exported-content');
const { PAIRS } = require('../merge-tag-syntax');

// A tag opened and never closed is sent as is: "Hello {{first_name," reaches
// the recipient. Every text of a block is read, hidden or not: a tag left open
// in a `display:none` span is sent all the same.
const EXCERPT_RADIUS = 25;

const count = (text, token) => text.split(token).length - 1;

/**
 * The first delimiter left unbalanced in a text, or null.
 * @returns {string|null}
 */
function unbalancedToken(text) {
  const pair = PAIRS.find(
    ([open, close]) => count(text, open) !== count(text, close)
  );
  if (pair) {
    return count(text, pair[0]) > count(text, pair[1]) ? pair[0] : pair[1];
  }
  return count(text, '%%') % 2 ? '%%' : null;
}

function excerptAround(text, token) {
  const at = text.indexOf(token);
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(text.length, at + token.length + EXCERPT_RADIUS);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${
    end < text.length ? '…' : ''
  }`;
}

const MESSAGES = {
  block: 'Personalization tag not closed (__token__): __excerpt__',
  subject:
    'Personalization tag not closed in the subject (__token__): __excerpt__',
  preheader:
    'Personalization tag not closed in the preheader (__token__): __excerpt__',
};

// `%%` opens and closes alike: an odd count may as well be "-50%% off".
const PERCENT_MESSAGES = {
  block:
    'Unbalanced %% (__excerpt__): a personalization tag left open, or a doubled percent sign',
  subject:
    'Unbalanced %% in the subject (__excerpt__): a personalization tag left open, or a doubled percent sign',
  preheader:
    'Unbalanced %% in the preheader (__excerpt__): a personalization tag left open, or a doubled percent sign',
};

module.exports = {
  id: 'merge-tags',
  category: 'copy',
  severity: 'error',
  titleKey: 'Personalization tags',
  passKey: 'Every personalization tag is closed',
  unbalancedToken,
  run(ctx) {
    const links = _.groupBy(blockLinks(ctx), 'blockId');
    // One source per text and per link: a `{{` of the text and a `}}` of a
    // link must not cancel out.
    const sources = _.flatMap(ctx.blocks.filter(Boolean), (block) => {
      const root = ctx.doc.getElementById(block.id);
      const texts = root ? [textOf(root)] : [];
      return texts
        .concat((links[block.id] || []).map((link) => link.href))
        .map((text) => ({ blockId: block.id, where: 'block', text }));
    });
    const subject = ctx.subject;
    if (subject)
      sources.push({ blockId: null, where: 'subject', text: subject });
    const preheader = ctx.preheader;
    if (preheader && preheader.value) {
      sources.push({
        blockId: null,
        where: 'preheader',
        text: preheader.value,
      });
    }

    return sources
      .map((source) => ({ ...source, token: unbalancedToken(source.text) }))
      .filter((source) => source.token)
      .map((source) => {
        const excerpt = excerptAround(source.text, source.token);
        return {
          messageKey: (source.token === '%%' ? PERCENT_MESSAGES : MESSAGES)[
            source.where
          ],
          params: { token: source.token, excerpt },
          blockId: source.blockId,
          propertyPath: source.where === 'block' ? null : source.where,
          value: `${source.token}|${excerpt}`,
        };
      });
  },
};
