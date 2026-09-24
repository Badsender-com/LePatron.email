'use strict';

// The server copies the editor's identifiers for the block, because it cannot
// import from a browser bundle. A comment saying "keep in sync" keeps nothing in
// sync: a renamed property would make the size and permission guards look for a
// block that no longer exists — and let everything through.

const editor = require('../../../packages/editor/src/js/ext/html-code-block/constants.js');
const guard = require('../../../packages/server/mailing/html-code-block-guard.js');
const protection = require('../../../packages/server/translation/html-code-block-protection.js');

describe('HTML code block identifiers, editor ↔ server', () => {
  it('the guard reads the block type and property the editor writes', () => {
    expect(guard.HTML_CODE_BLOCK_TYPE).toBe(editor.HTML_CODE_BLOCK_TYPE);
    expect(guard.HTML_CODE_PROPERTY).toBe(editor.HTML_CODE_PROPERTY);
  });

  it('the server enforces the limit the editor announces', () => {
    expect(guard.HTML_CODE_MAX_LENGTH).toBe(editor.HTML_CODE_MAX_LENGTH);
  });

  it('the translation protection looks for the marker the export emits', () => {
    expect(protection.HTML_CODE_MARKER_CLASS).toBe(
      editor.HTML_CODE_MARKER_CLASS
    );
  });
});
