'use strict';

// The two synthetic blocks are gated independently, and this is the file that
// says so. It exists separately from synthetic-block-guard.test.js because that
// file predates the second block and reads as "the HTML code block flag": the
// question here is not whether a flag works, it is whether one flag can ever
// stand in for the other.
//
// The case that matters is a client given the builder and NOT the raw HTML
// block — the client who wants the guard rails, and the reason there are two
// flags rather than one. Getting this wrong hands them exactly what the flag was
// meant to withhold, and nothing in the UI would show it.

const {
  bringsDisallowedSyntheticHtml,
  assertSyntheticHtmlAllowed,
  findDisallowedSyntheticBlock,
} = require('../../../packages/server/mailing/synthetic-block-guard.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const htmlBlock = (htmlCode) => ({ type: 'htmlCodeBlock', htmlCode });
const builderBlock = (builderHtml) => ({
  type: 'blockBuilderBlock',
  builderHtml,
});

const dataWith = (...blocks) => ({ mainBlocks: { blocks } });

const brings = (data, previousData, flags) =>
  bringsDisallowedSyntheticHtml({ data, previousData, flags });

const ONLY_BUILDER = { blockBuilderEnabled: true, htmlBlockEnabled: false };
const ONLY_HTML = { blockBuilderEnabled: false, htmlBlockEnabled: true };
const NEITHER = {};

describe('one flag never stands in for the other', () => {
  it('lets the builder through while refusing raw HTML', () => {
    expect(brings(dataWith(builderBlock('<p>x</p>')), {}, ONLY_BUILDER)).toBe(
      false
    );
    expect(brings(dataWith(htmlBlock('<p>x</p>')), {}, ONLY_BUILDER)).toBe(
      true
    );
  });

  it('lets raw HTML through while refusing the builder', () => {
    expect(brings(dataWith(htmlBlock('<p>x</p>')), {}, ONLY_HTML)).toBe(false);
    expect(brings(dataWith(builderBlock('<p>x</p>')), {}, ONLY_HTML)).toBe(
      true
    );
  });

  it('refuses both when neither flag is on', () => {
    expect(
      brings(
        dataWith(htmlBlock('<p>a</p>'), builderBlock('<p>b</p>')),
        {},
        NEITHER
      )
    ).toBe(true);
  });

  it('refuses the one that is off even beside one that is on', () => {
    const refused = findDisallowedSyntheticBlock({
      data: dataWith(builderBlock('<p>allowed</p>'), htmlBlock('<p>no</p>')),
      previousData: {},
      flags: ONLY_BUILDER,
    });

    expect(refused).not.toBeNull();
    expect(refused.type).toBe('htmlCodeBlock');
  });
});

describe('the refusal names the right feature', () => {
  const refuse = (block, flags) => {
    try {
      assertSyntheticHtmlAllowed({
        data: dataWith(block),
        previousData: {},
        flags,
      });
    } catch (error) {
      return error;
    }
    return null;
  };

  // Telling a client that the builder is disabled when it is the HTML code
  // block that was refused sends them to support for the wrong thing.
  it('reports the builder when the builder was refused', () => {
    expect(refuse(builderBlock('<p>x</p>'), ONLY_HTML).message).toBe(
      ERROR_CODES.BLOCK_BUILDER_DISABLED
    );
  });

  it('reports the HTML code block when that was refused', () => {
    expect(refuse(htmlBlock('<p>x</p>'), ONLY_BUILDER).message).toBe(
      ERROR_CODES.HTML_CODE_BLOCK_DISABLED
    );
  });

  it('refuses with 403, like the single-flag guard always did', () => {
    expect(refuse(builderBlock('<p>x</p>'), NEITHER).status).toBe(403);
  });
});

describe('already-stored markup is per block type', () => {
  // The grandfathering rule lets stored markup through so turning a flag off
  // cannot lock an author out of their own email. Matching it across types
  // would turn it into a bypass: paste markup into an HTML code block while
  // that flag is on, and the same bytes would become acceptable in a builder
  // block whose flag is off.
  it('does not let an HTML block excuse a builder block', () => {
    const stored = dataWith(htmlBlock('<p>same bytes</p>'));
    const next = dataWith(
      htmlBlock('<p>same bytes</p>'),
      builderBlock('<p>same bytes</p>')
    );

    expect(brings(next, stored, NEITHER)).toBe(true);
  });

  it('does not let a builder block excuse an HTML block', () => {
    const stored = dataWith(builderBlock('<p>same bytes</p>'));
    const next = dataWith(
      builderBlock('<p>same bytes</p>'),
      htmlBlock('<p>same bytes</p>')
    );

    expect(brings(next, stored, NEITHER)).toBe(true);
  });

  it('still grandfathers each type against its own stored markup', () => {
    const stored = dataWith(htmlBlock('<p>a</p>'), builderBlock('<p>b</p>'));

    expect(brings(stored, stored, NEITHER)).toBe(false);
  });

  // Turning a flag off must not stop anyone moving or duplicating what is
  // already there.
  it('accepts stored blocks of both types reordered and duplicated', () => {
    const stored = dataWith(htmlBlock('<p>a</p>'), builderBlock('<p>b</p>'));
    const reordered = dataWith(
      builderBlock('<p>b</p>'),
      { type: 'textBlock' },
      htmlBlock('<p>a</p>'),
      builderBlock('<p>b</p>')
    );

    expect(brings(reordered, stored, NEITHER)).toBe(false);
  });
});

describe('an empty block of either type is always accepted', () => {
  it.each([
    ['an HTML code block', htmlBlock('')],
    ['a builder block', builderBlock('')],
  ])('%s', (_label, block) => {
    expect(brings(dataWith(block), {}, NEITHER)).toBe(false);
  });
});
