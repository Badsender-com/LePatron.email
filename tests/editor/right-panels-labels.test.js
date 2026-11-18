'use strict';

// Every label the right panels read by its key exists in French and in
// English (ADR 0020): a key cleaned away by mistake shows raw in the editor.
//
// Read: the literal keys of t(…), including those of a ternary inside it;
// tCount(…) and countKey(…), with their « -one » key; the labels of every
// AI action. Not read: keys built by concatenation, passed through a prop or
// a lookup table (quality-meta.js), or held in a variable.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../packages/editor/src');
const FOLDERS = [
  'js/vue/components/comments',
  'js/vue/components/quality-drawer',
  'js/vue/components/ai-panel',
  'js/vue/components/right-panel',
  'js/ext/comments',
  'js/ext/quality',
];
// The panel rail's badge; the rail itself sits in main.tmpl.html, among
// Mosaico's own labels, and is read by panel-rail.test.js.
const FILES = ['tmpl-badsender/panel-rail-quality-badge.tmpl.html'];
const ACTIONS = path.join(SRC, 'js/ext/ai-panel/actions');

const fr = require('../../public/lang/badsender-fr.js');
const en = require('../../public/lang/badsender-en.js');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const sources = () =>
  FILES.map((file) => path.join(SRC, file)).concat(
    ...FOLDERS.map((folder) => walk(path.join(SRC, folder)))
  );

const CALL = /\bt\(([^()]*)\)/g;
const COUNT = /\b(?:tCount|countKey)\(\s*(['"])([^'"\n]+?)\1/g;
const LITERAL = /(['"])([^'"\n]+?)\1/g;
// A key, not a phrase of the text: no space, or a kebab-case word.
const isKey = (text) => /^[\w-]+$/.test(text) && !text.endsWith('-');

const used = new Set();
function read(text) {
  let call = CALL.exec(text);
  while (call) {
    const inside = call[1];
    // The key is the first argument, or both arms of a ternary there.
    const head = inside.split(/,(?![^{]*})/)[0];
    // A key built in a template string is not read (see above).
    if (head.includes('`')) {
      call = CALL.exec(text);
      continue; // eslint-disable-line no-continue
    }
    let literal = LITERAL.exec(head);
    while (literal) {
      if (isKey(literal[2]) || head.trim() === literal[0]) used.add(literal[2]);
      literal = LITERAL.exec(head);
    }
    call = CALL.exec(text);
  }
  let count = COUNT.exec(text);
  while (count) {
    used.add(count[2]);
    used.add(`${count[2]}-one`);
    count = COUNT.exec(text);
  }
}
sources().forEach((file) => read(fs.readFileSync(file, 'utf8')));

// The labels of the AI actions, read by the panel through labelsOf().
function labelsOf(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(labelsOf);
  }
  return [];
}
fs.readdirSync(ACTIONS)
  .filter((name) => !['index.js', 'text.js'].includes(name))
  .forEach((name) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const action = require(path.join(ACTIONS, name));
    labelsOf(action.labels).forEach((key) => used.add(key));
  });

describe('the labels of the right panels', () => {
  it('reads labels', () => {
    expect(used.size).toBeGreaterThan(150);
  });

  it.each(['fr', 'en'])('all exist in %s', (lang) => {
    const labels = lang === 'fr' ? fr : en;
    expect([...used].filter((key) => !(key in labels))).toEqual([]);
  });
});
