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

// The flag only hides the palette entry in the editor, and the block definition
// is injected into every template: on its own it stopped no hand-written request.
describe('html code block guard — the template flag', () => {
  const {
    findHtmlCodeBlocks,
    bringsDisallowedHtmlCode,
    assertHtmlCodeBlockContentAllowed,
    hasHtmlCodeBlock,
  } = require('../../../packages/server/mailing/html-code-block-guard.js');

  describe('findHtmlCodeBlocks', () => {
    it('finds blocks in every container, not only mainBlocks', () => {
      const data = {
        titleText: 'x',
        mainBlocks: { blocks: [htmlBlock('a')] },
        footerBlocks: { blocks: [{ type: 'textBlock' }, htmlBlock('b')] },
      };
      expect(findHtmlCodeBlocks(data).map((b) => b.htmlCode)).toEqual([
        'a',
        'b',
      ]);
    });

    it('measures the size across containers too', () => {
      const data = { footerBlocks: { blocks: [htmlBlock('x'.repeat(10))] } };
      expect(validateHtmlCodeBlocks(data, 5).valid).toBe(false);
    });
  });

  describe('bringsDisallowedHtmlCode', () => {
    const check = (data, previousData, htmlBlockEnabled) =>
      bringsDisallowedHtmlCode({ data, previousData, htmlBlockEnabled });

    it('allows anything when the template enables the block', () => {
      expect(check(dataWith(htmlBlock('<p>new</p>')), dataWith(), true)).toBe(
        false
      );
    });

    it('refuses new markup when the template does not', () => {
      expect(check(dataWith(htmlBlock('<p>new</p>')), dataWith(), false)).toBe(
        true
      );
    });

    it('refuses changed markup', () => {
      expect(
        check(
          dataWith(htmlBlock('<p>changed</p>')),
          dataWith(htmlBlock('<p>stored</p>')),
          false
        )
      ).toBe(true);
    });

    // Turning the flag off must not lock anyone out of their own email.
    it('keeps accepting markup already stored, moved or duplicated', () => {
      const stored = dataWith(htmlBlock('<p>a</p>'), htmlBlock('<p>b</p>'));
      const reordered = dataWith(
        htmlBlock('<p>b</p>'),
        { type: 'textBlock' },
        htmlBlock('<p>a</p>'),
        htmlBlock('<p>a</p>')
      );
      expect(check(reordered, stored, false)).toBe(false);
    });

    it('accepts an empty block, which renders nothing', () => {
      expect(check(dataWith(htmlBlock('')), dataWith(), false)).toBe(false);
    });

    it('treats a missing stored model as holding nothing', () => {
      expect(check(dataWith(htmlBlock('x')), undefined, false)).toBe(true);
    });
  });

  describe('assertHtmlCodeBlockContentAllowed (personalized blocks)', () => {
    it('refuses an HTML code block on a template without the flag', () => {
      expect(() =>
        assertHtmlCodeBlockContentAllowed({
          content: htmlBlock('<p>x</p>'),
          htmlBlockEnabled: false,
        })
      ).toThrow(expect.objectContaining({ status: 403 }));
    });

    it('accepts the stored block unchanged', () => {
      expect(() =>
        assertHtmlCodeBlockContentAllowed({
          content: htmlBlock('<p>x</p>'),
          previousContent: htmlBlock('<p>x</p>'),
          htmlBlockEnabled: false,
        })
      ).not.toThrow();
    });

    it('accepts any other block', () => {
      expect(() =>
        assertHtmlCodeBlockContentAllowed({
          content: { type: 'textBlock', text: '<p>x</p>' },
          htmlBlockEnabled: false,
        })
      ).not.toThrow();
    });
  });

  describe('hasHtmlCodeBlock', () => {
    it('recognizes a model and a single block', () => {
      expect(hasHtmlCodeBlock(dataWith(htmlBlock('x')))).toBe(true);
      expect(hasHtmlCodeBlock(htmlBlock('x'))).toBe(true);
      expect(hasHtmlCodeBlock(dataWith({ type: 'textBlock' }))).toBe(false);
      expect(hasHtmlCodeBlock(undefined)).toBe(false);
    });
  });
});
