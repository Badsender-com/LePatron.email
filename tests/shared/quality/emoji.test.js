'use strict';

const {
  countEmojis,
  startsWithEmoji,
} = require('../../../packages/shared/quality/emoji.js');

describe('countEmojis', () => {
  it.each([
    ['☝🏽', 1],
    ['✌🏽', 1],
    ['👍🏽', 1],
    ['👩‍⚕️', 1],
    ['🇫🇷', 1],
    ['1️⃣', 1],
    ['🔥🔥', 2],
    ['Brand® Line™ ©', 0],
    ['', 0],
  ])('counts %s as %i', (text, count) => {
    expect(countEmojis(text)).toBe(count);
  });
});

describe('startsWithEmoji', () => {
  it.each(['🌿 Linen sale', ' 🇫🇷 Made here', '1️⃣ First'])(
    'reads "%s" as starting with an emoji',
    (text) => {
      expect(startsWithEmoji(text)).toBe(true);
    }
  );

  it.each(['Linen sale 🌿', '© Brand', '1 First', ''])(
    'reads "%s" as starting with a word',
    (text) => {
      expect(startsWithEmoji(text)).toBe(false);
    }
  );
});
