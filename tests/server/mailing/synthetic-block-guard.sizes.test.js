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
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
} = require('../../../packages/server/mailing/synthetic-block-guard.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const htmlBlock = (htmlCode) => ({ type: 'htmlCodeBlock', htmlCode });
const builderBlock = (builderHtml, builderState) => ({
  type: 'blockBuilderBlock',
  builderHtml,
  builderState,
});
const dataWith = (...blocks) => ({ mainBlocks: { blocks } });
const longerThan = (limit) => 'x'.repeat(limit + 1);

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
