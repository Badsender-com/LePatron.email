'use strict';

const {
  validateSyntheticBlocks,
  findLongestSyntheticBlock,
  HTML_CODE_MAX_LENGTH,
} = require('../../../packages/server/mailing/synthetic-block-guard.js');

const htmlBlock = (html) => ({ type: 'htmlCodeBlock', htmlCode: html });
const dataWith = (...blocks) => ({ mainBlocks: { blocks } });

describe('html code block guard', () => {
  describe('findLongestSyntheticBlock', () => {
    it('returns 0 when there is no HTML code block', () => {
      expect(
        findLongestSyntheticBlock(
          dataWith({ type: 'textBlock', text: 'hello' })
        )
      ).toBe(0);
    });

    it('returns the length of the longest HTML code block', () => {
      const data = dataWith(
        htmlBlock('ab'),
        { type: 'textBlock', text: 'x'.repeat(50) },
        htmlBlock('abcd'),
        htmlBlock('abc')
      );
      expect(findLongestSyntheticBlock(data)).toBe(4);
    });

    it('ignores a non-string value', () => {
      expect(
        findLongestSyntheticBlock(dataWith({ type: 'htmlCodeBlock' }))
      ).toBe(0);
      expect(
        findLongestSyntheticBlock(
          dataWith({ type: 'htmlCodeBlock', htmlCode: 42 })
        )
      ).toBe(0);
    });

    it('tolerates malformed or missing data', () => {
      expect(findLongestSyntheticBlock(undefined)).toBe(0);
      expect(findLongestSyntheticBlock(null)).toBe(0);
      expect(findLongestSyntheticBlock({})).toBe(0);
      expect(findLongestSyntheticBlock({ mainBlocks: {} })).toBe(0);
      expect(findLongestSyntheticBlock({ mainBlocks: { blocks: null } })).toBe(
        0
      );
      expect(findLongestSyntheticBlock(dataWith(null, undefined))).toBe(0);
    });
  });

  describe('validateSyntheticBlocks', () => {
    it('accepts a mailing with no HTML code block', () => {
      const result = validateSyntheticBlocks(
        dataWith({ type: 'textBlock', text: 'hello' })
      );
      expect(result.valid).toBe(true);
      expect(result.maxLength).toBe(HTML_CODE_MAX_LENGTH);
    });

    it('accepts a block exactly at the limit', () => {
      const data = dataWith(htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH)));
      expect(validateSyntheticBlocks(data).valid).toBe(true);
    });

    it('rejects a block one character over the limit', () => {
      const data = dataWith(htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH + 1)));
      const result = validateSyntheticBlocks(data);
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
      expect(validateSyntheticBlocks(data).valid).toBe(false);
    });

    it('honours an explicit limit', () => {
      const data = dataWith(htmlBlock('abcdef'));
      expect(validateSyntheticBlocks(data, 5).valid).toBe(false);
      expect(validateSyntheticBlocks(data, 6).valid).toBe(true);
    });

    it('accepts an absent payload, so a save without data is untouched', () => {
      expect(validateSyntheticBlocks(undefined).valid).toBe(true);
    });
  });
});

// The flag only hides the palette entry in the editor, and the block definition
// is injected into every template: on its own it stopped no hand-written request.
describe('html code block guard — the template flag', () => {
  const {
    findSyntheticBlocks,
    bringsDisallowedSyntheticHtml,
    assertSyntheticBlockContentAllowed,
    hasSyntheticBlock,
  } = require('../../../packages/server/mailing/synthetic-block-guard.js');

  describe('findSyntheticBlocks', () => {
    it('finds blocks in every container, not only mainBlocks', () => {
      const data = {
        titleText: 'x',
        mainBlocks: { blocks: [htmlBlock('a')] },
        footerBlocks: { blocks: [{ type: 'textBlock' }, htmlBlock('b')] },
      };
      expect(findSyntheticBlocks(data).map((b) => b.htmlCode)).toEqual([
        'a',
        'b',
      ]);
    });

    it('measures the size across containers too', () => {
      const data = { footerBlocks: { blocks: [htmlBlock('x'.repeat(10))] } };
      expect(validateSyntheticBlocks(data, 5).valid).toBe(false);
    });
  });

  describe('bringsDisallowedSyntheticHtml', () => {
    const check = (data, previousData, htmlBlockEnabled) =>
      bringsDisallowedSyntheticHtml({
        data,
        previousData,
        flags: { htmlBlockEnabled },
      });

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

  describe('assertSyntheticBlockContentAllowed (personalized blocks)', () => {
    it('refuses an HTML code block on a template without the flag', () => {
      expect(() =>
        assertSyntheticBlockContentAllowed({
          content: htmlBlock('<p>x</p>'),
          flags: { htmlBlockEnabled: false },
        })
      ).toThrow(expect.objectContaining({ status: 403 }));
    });

    it('accepts the stored block unchanged', () => {
      expect(() =>
        assertSyntheticBlockContentAllowed({
          content: htmlBlock('<p>x</p>'),
          previousContent: htmlBlock('<p>x</p>'),
          flags: { htmlBlockEnabled: false },
        })
      ).not.toThrow();
    });

    it('accepts any other block', () => {
      expect(() =>
        assertSyntheticBlockContentAllowed({
          content: { type: 'textBlock', text: '<p>x</p>' },
          flags: { htmlBlockEnabled: false },
        })
      ).not.toThrow();
    });
  });

  describe('hasSyntheticBlock', () => {
    it('recognizes a model and a single block', () => {
      expect(hasSyntheticBlock(dataWith(htmlBlock('x')))).toBe(true);
      expect(hasSyntheticBlock(htmlBlock('x'))).toBe(true);
      expect(hasSyntheticBlock(dataWith({ type: 'textBlock' }))).toBe(false);
      expect(hasSyntheticBlock(undefined)).toBe(false);
    });
  });
});
