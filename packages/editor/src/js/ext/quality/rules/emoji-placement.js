'use strict';

const { blockTexts, excerpt } = require('../exported-content');
const { EMOJI } = require('../emoji');

// Screen readers read an emoji's name ("fire", "red heart"): inside a
// sentence it breaks it, several in a row turn into a list. At the end of a
// sentence it reads fine.
// The whole text of a block is judged, the template's own words included: a
// plain-text editable (a button label) is not a rich text, and the emoji the
// template ships are as read out as the client's.
// A letter, the emoji, then the sentence going on with a lowercase word.
const MID_SENTENCE = new RegExp(`\\p{L}[,]?\\s*${EMOJI}\\s*(?=\\p{Ll})`, 'u');
// Two in a row already read as a list of names.
const RUN = new RegExp(`(?:${EMOJI}\\s*){2,}`, 'u');

const AROUND = 20;

// The words around the emojis found: what changes when the client moves them.
const excerptAround = (text, match) =>
  excerpt(
    text.slice(
      Math.max(0, match.index - AROUND),
      match.index + match[0].length + AROUND
    )
  );

module.exports = {
  id: 'emoji-placement',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Emojis',
  passKey: 'Emojis sit at the end of sentences',
  run(ctx) {
    const texts = blockTexts(ctx);
    return ctx.blocks
      .filter(Boolean)
      .map((block) => ({ block, text: texts[block.id] || '' }))
      .map(({ block, text }) => {
        const run = RUN.exec(text);
        if (run) {
          return {
            block,
            text,
            match: run,
            messageKey:
              'Several emojis in a row: screen readers read each name',
          };
        }
        const mid = MID_SENTENCE.exec(text);
        if (mid) {
          return {
            block,
            text,
            match: mid,
            messageKey:
              'Emoji in the middle of a sentence: screen readers read its name there',
          };
        }
        return null;
      })
      .filter(Boolean)
      .map(({ block, text, match, messageKey }) => ({
        messageKey,
        blockId: block.id,
        value: excerptAround(text, match),
      }));
  },
};
