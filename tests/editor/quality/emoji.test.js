'use strict';

const {
  countEmojis,
} = require('../../../packages/editor/src/js/ext/quality/emoji.js');

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
