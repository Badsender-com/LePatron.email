'use strict';

const { blockTexts } = require('../exported-content');

// Screen readers read an emoji's name ("fire", "red heart"): inside a
// sentence it breaks it, several in a row turn into a list. At the end of a
// sentence it reads fine.
const EMOJI = '\\p{Extended_Pictographic}[\\u{FE0F}\\u{200D}\\p{Extended_Pictographic}]*';
// A letter, the emoji, then the sentence going on with a lowercase word.
const MID_SENTENCE = new RegExp(`\\p{L}[,]?\\s*${EMOJI}\\s*(?=\\p{Ll})`, 'u');
const RUN = new RegExp(`(?:${EMOJI}\\s*){3,}`, 'u');

module.exports = {
  id: 'emoji-placement',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Emojis',
  passKey: 'Emojis sit at the end of sentences',
  run(ctx) {
    const texts = blockTexts(ctx);
    return ctx.blocks
      .map((block) => ({ block, text: texts[block.id] || '' }))
      .map(({ block, text }) => {
        if (RUN.test(text)) {
          return { block, messageKey: 'Several emojis in a row: screen readers read each name' };
        }
        if (MID_SENTENCE.test(text)) {
          return { block, messageKey: 'Emoji in the middle of a sentence: screen readers read its name there' };
        }
        return null;
      })
      .filter(Boolean)
      .map(({ block, messageKey }) => ({
        messageKey,
        blockId: block.id,
        value: texts[block.id],
      }));
  },
};
