'use strict';

// CodeMirror 5 files for the HTML code block editor, in load order: the modes
// and the addon register themselves on the global CodeMirror, so the library
// comes first. Concatenated into the editor libs as globals (see gulpfile.js),
// and loaded as such by tests/editor/html-code-block/codemirror-bundle.test.js.
//
// CodeMirror ships no minified build: the production libs minify these into one
// file, CODEMIRROR_MIN_BUNDLE.
const CODEMIRROR_LIBS = Object.freeze([
  'node_modules/codemirror/lib/codemirror.js',
  'node_modules/codemirror/mode/xml/xml.js',
  'node_modules/codemirror/mode/javascript/javascript.js',
  'node_modules/codemirror/mode/css/css.js',
  'node_modules/codemirror/mode/htmlmixed/htmlmixed.js',
  'node_modules/codemirror/addon/display/placeholder.js',
]);

const CODEMIRROR_MIN_BUNDLE = 'codemirror.bundle.min.js';

module.exports = { CODEMIRROR_LIBS, CODEMIRROR_MIN_BUNDLE };
