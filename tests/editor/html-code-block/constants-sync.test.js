'use strict';

// The editor and the server read the synthetic blocks from one table
// (packages/shared/synthetic-blocks.js). What can still drift is what each side
// adds or derives on its own: a renamed property would make the size and
// permission guards look for a block that no longer exists — and let everything
// through — and a missing error code would refuse a block in the name of the
// other one.
//
// Driven off the table rather than a hand-written pair of assertions, so a third
// synthetic block added there fails here until the server knows how to refuse it.

const SHARED = require('../../../packages/shared/synthetic-blocks.js');
const editorBlockTypes = require('../../../packages/editor/src/js/ext/html-code-block/block-types.js');
const editorConstants = require('../../../packages/editor/src/js/ext/html-code-block/constants.js');
const guard = require('../../../packages/server/mailing/synthetic-block-guard.js');
const protection = require('../../../packages/server/translation/html-code-block-protection.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const serverBlockFor = (type) =>
  guard.SYNTHETIC_BLOCKS.find((block) => block.type === type);

describe('synthetic block identifiers, editor ↔ server', () => {
  it('the editor injects the shared table, not a copy of it', () => {
    expect(editorBlockTypes.SYNTHETIC_BLOCKS).toBe(SHARED.SYNTHETIC_BLOCKS);
  });

  it('the server knows exactly the blocks the editor injects', () => {
    expect(guard.SYNTHETIC_BLOCKS.map((block) => block.type)).toEqual(
      SHARED.SYNTHETIC_BLOCKS.map((block) => block.type)
    );
  });

  describe.each(SHARED.SYNTHETIC_BLOCKS.map((block) => [block.type, block]))(
    '%s',
    (type, sharedBlock) => {
      it('the guard reads the property the editor writes', () => {
        expect(serverBlockFor(type).htmlProperty).toBe(
          sharedBlock.htmlProperty
        );
      });

      it('the guard checks the flag the palette obeys', () => {
        expect(serverBlockFor(type).flag).toBe(sharedBlock.flag);
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
      SHARED.SYNTHETIC_BLOCKS.map((block) => block.flag).sort()
    );
  });

  it('the server enforces the limit the editor announces', () => {
    expect(guard.HTML_CODE_MAX_LENGTH).toBe(
      editorConstants.HTML_CODE_MAX_LENGTH
    );
  });

  it('the translation protection looks for the markers the export emits', () => {
    expect(protection.MARKER_CLASSES.slice().sort()).toEqual(
      SHARED.SYNTHETIC_BLOCKS.map((block) => block.markerClass).sort()
    );
  });
});
