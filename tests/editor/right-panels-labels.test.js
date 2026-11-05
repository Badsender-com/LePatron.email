'use strict';

// Every label the right panels read by its key exists in French and in
// English (ADR 0020): a key cleaned away by mistake shows raw in the editor.

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

const fr = require('../../public/lang/badsender-fr.js');
const en = require('../../public/lang/badsender-en.js');

function sources() {
  const files = FILES.map((file) => path.join(SRC, file));
  FOLDERS.forEach((folder) => {
    const dir = path.join(SRC, folder);
    fs.readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .forEach((name) => files.push(path.join(dir, name)));
  });
  return files;
}

// t('key'), t("key"), $root.t('key'), vm.t('key'): literal keys only.
const KEY = /\bt\(\s*(['"])([^'"\n]+?)\1/g;

const used = new Set();
sources().forEach((file) => {
  const text = fs.readFileSync(file, 'utf8');
  let match = KEY.exec(text);
  while (match) {
    // A key built by concatenation ('comments-severity-' + …) is not one.
    if (!match[2].endsWith('-')) used.add(match[2]);
    match = KEY.exec(text);
  }
});

describe('the labels of the right panels', () => {
  it('reads labels', () => {
    expect(used.size).toBeGreaterThan(50);
  });

  it.each(['fr', 'en'])('all exist in %s', (lang) => {
    const labels = lang === 'fr' ? fr : en;
    expect([...used].filter((key) => !(key in labels))).toEqual([]);
  });
});
