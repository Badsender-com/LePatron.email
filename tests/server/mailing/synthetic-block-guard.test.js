'use strict';

const {
  findSyntheticBlocks,
  HTML_CODE_MAX_LENGTH,
} = require('../../../packages/server/mailing/synthetic-block-guard.js');
const {
  validateSyntheticBlocks,
} = require('../../../packages/server/mailing/synthetic-block-sizes.js');

const { htmlBlock, dataWith } = require('./synthetic-blocks.fixtures.js');

describe('synthetic block guard — sizes', () => {
  describe('validateSyntheticBlocks', () => {
    it('accepts a mailing with no HTML code block', () => {
      const result = validateSyntheticBlocks(
        dataWith({ type: 'textBlock', text: 'hello' })
      );
      expect(result.valid).toBe(true);
      expect(result.errorCode).toBeNull();
    });

    it('accepts a block exactly at the limit', () => {
      const data = dataWith(htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH)));
      expect(validateSyntheticBlocks(data).valid).toBe(true);
    });

    it('rejects a block one character over the limit', () => {
      const data = dataWith(htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH + 1)));
      const result = validateSyntheticBlocks(data);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HTML_CODE_BLOCK_TOO_LARGE');
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

    it('measures nothing but a string', () => {
      expect(
        validateSyntheticBlocks(dataWith({ type: 'htmlCodeBlock' }), 0)
      ).toEqual({
        valid: true,
        errorCode: null,
      });
      expect(
        validateSyntheticBlocks(
          dataWith({ type: 'htmlCodeBlock', htmlCode: 42 }),
          0
        ).valid
      ).toBe(true);
    });
  });

  describe('findSyntheticBlocks', () => {
    it('tolerates malformed or missing data', () => {
      [
        undefined,
        null,
        {},
        { mainBlocks: {} },
        { mainBlocks: { blocks: null } },
        dataWith(null, undefined),
      ].forEach((data) => expect(findSyntheticBlocks(data)).toEqual([]));
    });
  });
});

// The flag only hides the palette entry in the editor, and the block definition
// is injected into every template: on its own it stopped no hand-written request.
describe('synthetic block guard — the template flag', () => {
  const {
    findDisallowedSyntheticBlock,
    assertSyntheticHtmlAllowed,
    asModel,
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

  describe('findDisallowedSyntheticBlock', () => {
    const check = (data, previousData, htmlBlockEnabled) =>
      findDisallowedSyntheticBlock({
        data,
        previousData,
        flags: { htmlBlockEnabled },
      }) !== null;

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

  // A personalized block is one block, not a content model: wrapped, it gets
  // the same gate.
  describe('a single block, through asModel', () => {
    const assertAllowed = (content, previousContent) =>
      assertSyntheticHtmlAllowed({
        data: asModel(content),
        previousData: asModel(previousContent),
        flags: { htmlBlockEnabled: false },
      });

    it('refuses an HTML code block on a template without the flag', () => {
      expect(() => assertAllowed(htmlBlock('<p>x</p>'))).toThrow(
        expect.objectContaining({ status: 403 })
      );
    });

    it('accepts the stored block unchanged', () => {
      expect(() =>
        assertAllowed(htmlBlock('<p>x</p>'), htmlBlock('<p>x</p>'))
      ).not.toThrow();
    });

    it('accepts any other block, and no block at all', () => {
      expect(() =>
        assertAllowed({ type: 'textBlock', text: '<p>x</p>' })
      ).not.toThrow();
      expect(asModel(undefined)).toEqual({ blocks: { blocks: [] } });
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
