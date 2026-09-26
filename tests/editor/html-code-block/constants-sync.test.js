'use strict';

// The server copies the editor's identifiers for the synthetic blocks, because
// it cannot import from a browser bundle. A comment saying "keep in sync" keeps
// nothing in sync: a renamed property would make the size and permission guards
// look for a block that no longer exists — and let everything through.
//
// Driven off the editor's descriptor list rather than a hand-written pair of
// assertions, so a third synthetic block added there fails here until the server
// knows about it too.

const editorConstants = require('../../../packages/editor/src/js/ext/html-code-block/constants.js');
const {
  SYNTHETIC_BLOCKS: EDITOR_BLOCKS,
} = require('../../../packages/editor/src/js/ext/html-code-block/block-types.js');
const guard = require('../../../packages/server/mailing/synthetic-block-guard.js');
const protection = require('../../../packages/server/translation/html-code-block-protection.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const serverBlockFor = (type) =>
  guard.SYNTHETIC_BLOCKS.find((block) => block.type === type);

describe('synthetic block identifiers, editor ↔ server', () => {
  it('the server knows exactly the blocks the editor injects', () => {
    expect(guard.SYNTHETIC_BLOCKS.map((block) => block.type).sort()).toEqual(
      EDITOR_BLOCKS.map((block) => block.type).sort()
    );
  });

  describe.each(EDITOR_BLOCKS.map((block) => [block.type, block]))(
    '%s',
    (type, editorBlock) => {
      it('the guard reads the property the editor writes', () => {
        expect(serverBlockFor(type).htmlProperty).toBe(
          editorBlock.htmlProperty
        );
      });

      it('the guard checks the flag the palette obeys', () => {
        expect(serverBlockFor(type).flag).toBe(editorBlock.flag);
      });

      // A refusal naming the wrong feature is worse than a generic one: a client
      // given the builder but not the HTML code block would be told the builder
      // is disabled.
      it('is refused with an error code of its own', () => {
        const code = serverBlockFor(type).errorCode;
        expect(code).toBeTruthy();
        expect(ERROR_CODES[code]).toBe(code);
      });
    }
  );

  it('refuses each block with a distinct error code', () => {
    const codes = guard.SYNTHETIC_BLOCKS.map((block) => block.errorCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('the server loads every flag it is about to read', () => {
    expect(Object.keys(guard.TEMPLATE_FLAG_PROJECTION).sort()).toEqual(
      EDITOR_BLOCKS.map((block) => block.flag).sort()
    );
  });

  it('the server enforces the limit the editor announces', () => {
    expect(guard.HTML_CODE_MAX_LENGTH).toBe(
      editorConstants.HTML_CODE_MAX_LENGTH
    );
  });

  it('the translation protection looks for the markers the export emits', () => {
    expect(
      [
        protection.HTML_CODE_MARKER_CLASS,
        protection.BLOCK_BUILDER_MARKER_CLASS,
      ].sort()
    ).toEqual(EDITOR_BLOCKS.map((block) => block.markerClass).sort());
  });
});
