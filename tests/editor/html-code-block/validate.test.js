'use strict';

const {
  validateHtmlCodeLength,
} = require('../../../packages/editor/src/js/ext/html-code-block/validate.js');
const {
  HTML_CODE_MAX_LENGTH,
} = require('../../../packages/editor/src/js/ext/html-code-block/constants.js');

describe('validateHtmlCodeLength', () => {
  it('accepts markup under the limit', () => {
    const result = validateHtmlCodeLength('<table></table>');
    expect(result.valid).toBe(true);
    expect(result.length).toBe(15);
    expect(result.maxLength).toBe(HTML_CODE_MAX_LENGTH);
  });

  it('accepts markup exactly at the limit', () => {
    const result = validateHtmlCodeLength('x'.repeat(HTML_CODE_MAX_LENGTH));
    expect(result.valid).toBe(true);
  });

  it('rejects markup one character over the limit', () => {
    const result = validateHtmlCodeLength('x'.repeat(HTML_CODE_MAX_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.length).toBe(HTML_CODE_MAX_LENGTH + 1);
  });

  it('accepts an empty or missing value', () => {
    expect(validateHtmlCodeLength('').valid).toBe(true);
    expect(validateHtmlCodeLength(null).valid).toBe(true);
    expect(validateHtmlCodeLength(undefined).length).toBe(0);
  });

  it('honours an explicit limit', () => {
    expect(validateHtmlCodeLength('abcdef', 5).valid).toBe(false);
    expect(validateHtmlCodeLength('abcde', 5).valid).toBe(true);
  });

  it('counts characters, so multi-byte markup is not under-counted', () => {
    // 'é' is one character but two UTF-8 bytes; the limit is a character limit.
    expect(validateHtmlCodeLength('éé', 2).valid).toBe(true);
    expect(validateHtmlCodeLength('ééé', 2).valid).toBe(false);
  });
});
