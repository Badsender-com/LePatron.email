'use strict';

// Every string the gallery panel shows goes through the editor's
// dictionaries. A key with no entry does not fail anywhere: `vm.t` warns to
// the console and returns the key, so the user reads
// "gallery-edit-action" in the interface. That has happened.

const fs = require('fs');
const path = require('path');

const fr = require('../../public/lang/badsender-fr.js');
const en = require('../../public/lang/badsender-en.js');

const ROOT = path.join(__dirname, '../../packages/editor/src/js');

// Read the keys off the sources themselves, so one added there is checked
// without being listed here.
const SOURCES = [
  'vue/galleryPlugin.js',
  'ext/badsender-remove-gallery-image.js',
  'ext/badsender-rename-gallery-image.js',
  'ext/badsender-edit-image.js',
];

const literalKeys = SOURCES.flatMap((file) => {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return Array.from(
    source.matchAll(/(?:vm|viewModel)\.t\(\s*'(gallery-[^']+)'/g),
    (match) => match[1]
  );
});

// Built at runtime from the panel's own state, so no regex can see them.
const computedKeys = [
  'gallery-mailing-empty',
  'gallery-template-empty',
  'gallery-filter-all',
  'gallery-filter-jpg',
  'gallery-filter-png',
  'gallery-filter-gif',
  'gallery-sort-newest',
  'gallery-sort-oldest',
  'gallery-sort-newest-title',
  'gallery-sort-oldest-title',
  'gallery-image-count',
  'gallery-image-count-one',
  'gallery-search-no-result',
  'gallery-filter-no-result',
  // the rename extension picks one of these from the server's status code
  'gallery-rename-image-invalid',
  'gallery-rename-image-forbidden',
  'gallery-rename-image-gone',
  'gallery-rename-image-unsupported',
  'gallery-rename-image-fail',
  'gallery-rename-image-empty',
];

// The image editor's own strings travel through a separate bag, built in
// app.js, and do not carry the `gallery-` prefix.
const editorKeys = ['upload', 'upload-as-new-file', 'cancel'];

const keys = Array.from(new Set(literalKeys.concat(computedKeys, editorKeys)));

describe('gallery strings', () => {
  it('reads keys off the sources', () => {
    expect(literalKeys).toContain('gallery-edit-action');
    expect(literalKeys).toContain('gallery-remove-image-confirm');
    expect(literalKeys.length).toBeGreaterThan(10);
  });

  it.each(keys)('%s is translated in French', (key) => {
    expect(typeof fr[key]).toBe('string');
    expect(fr[key]).not.toBe('');
  });

  it.each(keys)('%s is translated in English', (key) => {
    expect(typeof en[key]).toBe('string');
    expect(en[key]).not.toBe('');
  });

  // The thumbnail substitutes `__label__` itself, from one bag shared by
  // every cell. A translation that dropped the token would name no image at
  // all, and all three buttons would read alike.
  it.each([
    'gallery-edit-action',
    'gallery-rename-action',
    'gallery-remove-image',
    'gallery-remove-image-confirm',
  ])('%s keeps its __label__ placeholder in both languages', (key) => {
    expect(fr[key]).toContain('__label__');
    expect(en[key]).toContain('__label__');
  });
});
