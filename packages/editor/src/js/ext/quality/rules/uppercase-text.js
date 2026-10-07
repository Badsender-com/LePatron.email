'use strict';

const { blockTexts } = require('../exported-content');
const { thresholdOf } = require('../settings');

// Past this many words in a row in capital letters, some screen readers spell
// them out letter by letter, and the text gets harder to read, for dyslexic
// readers first. Written capitals only: CSS text-transform is the template's.

const isUppercaseWord = (word) => {
  const letters = word.match(/\p{L}/gu) || [];
  return letters.length >= 2 && letters.every((l) => l !== l.toLowerCase());
};

// The longest run of uppercase words, as text.
function longestUppercaseRun(text) {
  let best = [];
  let current = [];
  text.split(/\s+/).forEach((word) => {
    if (isUppercaseWord(word)) {
      current.push(word);
      if (current.length > best.length) best = current.slice();
    } else if (/\p{L}/u.test(word)) {
      current = [];
    }
  });
  return best;
}

module.exports = {
  id: 'uppercase-text',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Capital letters',
  passKey: 'No long passage is written in capital letters',
  run(ctx) {
    const texts = blockTexts(ctx);
    return ctx.blocks
      .map((block) => ({ block, run: longestUppercaseRun(texts[block.id] || '') }))
      .filter(({ run }) => run.length > thresholdOf(ctx, 'uppercase-text', 'maxWords'))
      .map(({ block, run }) => ({
        messageKey: 'Long passage in capital letters (__count__ words): __excerpt__',
        params: { count: run.length, excerpt: run.slice(0, 8).join(' ') },
        blockId: block.id,
        value: run.join(' '),
      }));
  },
};
