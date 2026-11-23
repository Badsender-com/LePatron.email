'use strict';

const {
  EMAIL_COPY_LIMITS,
  fitEmailCopy,
} = require('../../../packages/shared/text-generation/email-copy-limits.js');

const piece = (text, role = 'text') => ({ role, text });
const total = (copy) => copy.reduce((sum, p) => sum + p.text.length, 0);

describe('shared: fitting the email copy to what text generation accepts', () => {
  it('leaves a copy within the limits as it is', () => {
    const copy = [piece('Soldes', 'title'), piece('Jusqu’à -50 %')];
    expect(fitEmailCopy(copy)).toEqual(copy);
  });

  it('cuts a piece longer than a piece may be', () => {
    const [fitted] = fitEmailCopy([piece('a'.repeat(5000))]);
    expect(fitted.text).toHaveLength(EMAIL_COPY_LIMITS.maxTextLength);
  });

  it('keeps the beginning of the email when the whole is too long', () => {
    const copy = Array.from({ length: 10 }, (_, i) =>
      piece(String(i).repeat(EMAIL_COPY_LIMITS.maxTextLength))
    );
    const fitted = fitEmailCopy(copy);
    expect(total(fitted)).toBe(EMAIL_COPY_LIMITS.maxTotalLength);
    expect(fitted[0].text[0]).toBe('0');
    expect(fitted).toHaveLength(8);
  });

  it('cuts the last piece to what is left', () => {
    const full = 'a'.repeat(EMAIL_COPY_LIMITS.maxTextLength);
    const copy = [
      ...Array.from({ length: 7 }, () => piece(full)),
      piece('a'.repeat(3990)),
      piece('b'.repeat(100)),
    ];
    const fitted = fitEmailCopy(copy);
    expect(fitted[8].text).toBe('b'.repeat(10));
    expect(total(fitted)).toBe(EMAIL_COPY_LIMITS.maxTotalLength);
  });

  it('keeps no more pieces than allowed', () => {
    const copy = Array.from({ length: 250 }, () => piece('x'));
    expect(fitEmailCopy(copy)).toHaveLength(EMAIL_COPY_LIMITS.maxItems);
  });
});
