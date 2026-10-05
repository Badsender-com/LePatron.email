'use strict';

// The size guard, for the block builder.
//
// The builder stores two strings in its block: the markup it generated and the
// state it reopens from. Both sit in the mailing document, and the editor's own
// check can be bypassed by any hand-written request, so both are bounded here —
// and refused in the builder's name, since its composer has no HTML code block
// to shorten.

const {
  validateSyntheticBlocks,
  findOversizedSyntheticBlock,
  syntheticContentLength,
} = require('../../../packages/server/mailing/synthetic-block-sizes.js');
const {
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
  SYNTHETIC_CONTENT_MAX_LENGTH,
} = require('../../../packages/shared/synthetic-blocks.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const {
  htmlBlock,
  builderBlock,
  dataWith,
  longerThan,
} = require('./synthetic-blocks.fixtures.js');

describe('findOversizedSyntheticBlock', () => {
  it('finds nothing in a mailing within the limits', () => {
    const data = dataWith(
      htmlBlock('x'.repeat(HTML_CODE_MAX_LENGTH)),
      builderBlock('x'.repeat(HTML_CODE_MAX_LENGTH), '{"v":1}')
    );
    expect(findOversizedSyntheticBlock(data)).toBeNull();
  });

  it('names the builder when its markup is too long', () => {
    const data = dataWith(
      htmlBlock('<p>small</p>'),
      builderBlock(longerThan(HTML_CODE_MAX_LENGTH), '')
    );
    expect(findOversizedSyntheticBlock(data).tooLargeErrorCode).toBe(
      ERROR_CODES.BLOCK_BUILDER_TOO_LARGE
    );
  });

  it('names the HTML code block when its markup is too long', () => {
    const data = dataWith(htmlBlock(longerThan(HTML_CODE_MAX_LENGTH)));
    expect(findOversizedSyntheticBlock(data).tooLargeErrorCode).toBe(
      ERROR_CODES.HTML_CODE_BLOCK_TOO_LARGE
    );
  });

  // Nothing else bounds the state: it is never rendered, so a crafted request
  // could stuff it while keeping the markup small.
  it('refuses a builder state past its own limit', () => {
    const data = dataWith(
      builderBlock('<p>x</p>', longerThan(BUILDER_STATE_MAX_LENGTH))
    );
    expect(findOversizedSyntheticBlock(data).tooLargeErrorCode).toBe(
      ERROR_CODES.BLOCK_BUILDER_TOO_LARGE
    );
  });

  it('accepts a state exactly at the limit', () => {
    const data = dataWith(
      builderBlock('<p>x</p>', 'x'.repeat(BUILDER_STATE_MAX_LENGTH))
    );
    expect(findOversizedSyntheticBlock(data)).toBeNull();
  });

  // The HTML code block keeps no state: a property of that name on it is not
  // something the editor wrote, and is not what this bound is about.
  it('reads a state only on the block that keeps one', () => {
    const block = {
      ...htmlBlock('<p>x</p>'),
      builderState: longerThan(BUILDER_STATE_MAX_LENGTH),
    };
    expect(findOversizedSyntheticBlock(dataWith(block))).toBeNull();
  });

  it('ignores a state that is not a string', () => {
    const data = dataWith(builderBlock('<p>x</p>', { huge: true }));
    expect(findOversizedSyntheticBlock(data)).toBeNull();
  });
});

describe('validateSyntheticBlocks', () => {
  it('carries the code naming the refused block', () => {
    const result = validateSyntheticBlocks(
      dataWith(builderBlock('<p>x</p>', longerThan(BUILDER_STATE_MAX_LENGTH)))
    );
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.BLOCK_BUILDER_TOO_LARGE);
  });

  it('carries no code when everything fits', () => {
    expect(validateSyntheticBlocks(dataWith()).errorCode).toBeNull();
  });
});

// Each block is bounded, but not how many a request brings: without a bound on
// the sum, enough blocks just under their own limit still reach Mongo's.
describe('the sum of every block', () => {
  // As many HTML code blocks at their maximum as the sum allows, plus `extra`.
  const blocksUpTo = (extra) => {
    const count = Math.floor(
      SYNTHETIC_CONTENT_MAX_LENGTH / HTML_CODE_MAX_LENGTH
    );
    const rest = SYNTHETIC_CONTENT_MAX_LENGTH - count * HTML_CODE_MAX_LENGTH;
    const full = 'x'.repeat(HTML_CODE_MAX_LENGTH);
    return dataWith(
      ...Array.from({ length: count }, () => htmlBlock(full)),
      htmlBlock('x'.repeat(rest + extra))
    );
  };

  it('counts the markup and the state of every synthetic block', () => {
    const data = dataWith(
      htmlBlock('abc'),
      { type: 'textBlock', text: 'not counted' },
      builderBlock('de', 'fghi')
    );
    expect(syntheticContentLength(data)).toBe(9);
  });

  it('accepts content exactly at the bound', () => {
    expect(validateSyntheticBlocks(blocksUpTo(0))).toEqual({
      valid: true,
      errorCode: null,
    });
  });

  it('refuses content past it, every block fitting', () => {
    expect(validateSyntheticBlocks(blocksUpTo(1)).errorCode).toBe(
      ERROR_CODES.SYNTHETIC_CONTENT_TOO_LARGE
    );
  });

  // The block's own refusal says which one to shorten.
  it('names an oversized block first', () => {
    const data = blocksUpTo(1);
    data.mainBlocks.blocks.push(builderBlock(longerThan(HTML_CODE_MAX_LENGTH)));
    expect(validateSyntheticBlocks(data).errorCode).toBe(
      ERROR_CODES.BLOCK_BUILDER_TOO_LARGE
    );
  });

  // Far above any real email, and leaves room under Mongo's 16MB for the
  // previewHtml stored in the same document.
  it('sits between a real email and the document limit', () => {
    const {
      PREVIEW_HTML_MAX_LENGTH,
    } = require('../../../packages/server/utils/preview-html-sanitizer.js');
    expect(SYNTHETIC_CONTENT_MAX_LENGTH).toBeGreaterThanOrEqual(
      10 * (HTML_CODE_MAX_LENGTH + BUILDER_STATE_MAX_LENGTH)
    );
    expect(SYNTHETIC_CONTENT_MAX_LENGTH + PREVIEW_HTML_MAX_LENGTH).toBeLessThan(
      12 * 1024 * 1024
    );
  });
});
