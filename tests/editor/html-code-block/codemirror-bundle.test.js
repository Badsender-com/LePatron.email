/**
 * @jest-environment node
 */

'use strict';

// The production editor libs minify CodeMirror into one file (gulpfile.js
// mosaicoLib). A CodeMirror upgrade the minifier cannot parse, a file list in the
// wrong order — a mode loaded before the library — or a mode missing from it
// would only show in a browser, as an HTML code modal that never opens. This
// builds the same bundle, the same way, and runs it.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const uglify = require(require.resolve('uglify-js', {
  paths: [path.dirname(require.resolve('gulp-uglify'))],
}));
const {
  CODEMIRROR_LIBS,
} = require('../../../packages/editor/codemirror-libs.js');

const ROOT = path.join(__dirname, '../../..');

function loadMinifiedBundle() {
  const source = CODEMIRROR_LIBS.map((file) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8')
  ).join('\n');
  const minified = uglify.minify(source);
  if (minified.error) throw minified.error;

  const dom = new JSDOM('<!doctype html><body><textarea></textarea></body>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  // jsdom has no layout: CodeMirror measures text through ranges.
  dom.window.document.createRange = () => ({
    setEnd() {},
    setStart() {},
    getBoundingClientRect: () => ({ right: 0 }),
    getClientRects: () => ({ length: 0 }),
  });
  dom.window.eval(minified.code);
  return { window: dom.window, size: minified.code.length, source };
}

describe('minified CodeMirror bundle', () => {
  const { window, size, source } = loadMinifiedBundle();
  const { CodeMirror } = window;

  it('defines CodeMirror and every mode the modal uses', () => {
    expect(typeof CodeMirror).toBe('function');
    ['htmlmixed', 'xml', 'javascript', 'css'].forEach((mode) => {
      expect(CodeMirror.modes[mode]).toBeDefined();
    });
  });

  // The options html-code-modal.js creates its editor with.
  it('edits a value without altering it', () => {
    const editor = CodeMirror.fromTextArea(
      window.document.querySelector('textarea'),
      {
        mode: 'htmlmixed',
        lineNumbers: true,
        lineWrapping: true,
        autoCloseTags: false,
        electricChars: false,
        placeholder: 'Paste here',
      }
    );
    const pasted = '<%@ include view="x" %>\n<p>$& $1</p>';
    editor.setValue(pasted);
    expect(editor.getValue()).toBe(pasted);
  });

  it('is actually minified', () => {
    expect(size).toBeLessThan(source.length * 0.6);
  });
});
