'use strict';

const {
  validateHtmlCodeBlocks,
  findLongestHtmlCodeBlock,
  HTML_CODE_MAX_LENGTH,
} = require('../../../packages/server/mailing/html-code-block-guard.js');

const htmlBlock = (html) => ({ type: 'htmlCodeBlock', htmlCode: html });
const dataWith = (...blocks) => ({ mainBlocks: { blocks } });

describe('html code block guard', () => {
  describe('findLongestHtmlCodeBlock', () => {
    it('returns 0 when there is no HTML code block', () => {
      expect(
        findLongestHtmlCodeBlock(dataWith({ type: 'textBlock', text: 'hello' }))
      ).toBe(0);
    });

    it('returns the length of the longest HTML code block', () => {
      const data = dataWith(
        htmlBlock('ab'),
        { type: 'textBlock', text: 'x'.repeat(50) },
        htmlBlock('abcd'),
        htmlBlock('abc')
      );
      expect(findLongestHtmlCodeBlock(data)).toBe(4);
    });

    it('ignores a non-string value', () => {
      expect(
        findLongestHtmlCodeBlock(dataWith({ type: 'htmlCodeBlock' }))
      ).toBe(0);
      expect(
        findLongestHtmlCodeBlock(
          dataWith({ type: 'htmlCodeBlock', htmlCode: 42 })
        )
      ).toBe(0);
    });

    it('tolerates malformed or missing data', () => {
      expect(findLongestHtmlCodeBlock(undefined)).toBe(0);
      expect(findLongestHtmlCodeBlock(null)).toBe(0);
      expect(findLongestHtmlCodeBlock({})).toBe(0);
      expect(findLongestHtmlCodeBlock({ mainBlocks: {} })).toBe(0);
      expect(findLongestHtmlCodeBlock({ mainBlocks: { blocks: null } })).toBe(
        0
      );
      expect(findLongestHtmlCodeBlock(dataWith(null, undefined))).toBe(0);
    });
  });

  describe('validateHtmlCodeBlocks', () => {
    it('accepts a mailing with no HTML code block', () => {
      const result = validateHtmlCodeBlocks(
        dataWith({ type: 'textBlock', text: 'hello' })
      );
      expect(result.valid).toBe(true);
      expect(result.maxLength).toBe(HTML_CODE_MAX_LENGTH);
    });

    it('accepts a block exactly at the limit', () => {
      const data = dataWith(htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH)));
      expect(validateHtmlCodeBlocks(data).valid).toBe(true);
    });

    it('rejects a block one character over the limit', () => {
      const data = dataWith(htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH + 1)));
      const result = validateHtmlCodeBlocks(data);
      expect(result.valid).toBe(false);
      expect(result.length).toBe(HTML_CODE_MAX_LENGTH + 1);
    });

    // The editor enforces the same limit, so this only fires on a crafted or
    // scripted request — exactly what the guard is for.
    it('rejects when only one block among many is oversized', () => {
      const data = dataWith(
        htmlBlock('small'),
        htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH + 1))
      );
      expect(validateHtmlCodeBlocks(data).valid).toBe(false);
    });

    it('honours an explicit limit', () => {
      const data = dataWith(htmlBlock('abcdef'));
      expect(validateHtmlCodeBlocks(data, 5).valid).toBe(false);
      expect(validateHtmlCodeBlocks(data, 6).valid).toBe(true);
    });

    it('accepts an absent payload, so a save without data is untouched', () => {
      expect(validateHtmlCodeBlocks(undefined).valid).toBe(true);
    });
  });
});
