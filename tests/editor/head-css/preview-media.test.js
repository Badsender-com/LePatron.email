'use strict';

// One definition of what each preview mode does to media queries, read by the
// template's stylesheet (badsender-screen-preview.js) and the head CSS
// (head-css/canvas-preview.js). Two copies had already drifted: the head CSS
// forced its queries in `mobile` only, the template in `both` as well.

const {
  previewMediaFor,
  ALWAYS_TRUE_MEDIA,
  VISIBLE_ON_BOTH_SUFFIX,
} = require('../../../packages/editor/src/js/ext/preview-media.js');

describe('previewMediaFor', () => {
  test.each([
    ['mobile', true, ''],
    ['both', true, VISIBLE_ON_BOTH_SUFFIX],
    ['desktop', false, ''],
    ['large', false, ''],
    [undefined, false, ''],
  ])('%s -> forced: %s, suffix: "%s"', (mode, forceMedia, suffix) => {
    expect(previewMediaFor(mode)).toEqual({
      forceMedia,
      mediaSelectorSuffix: suffix,
    });
  });

  it('forces a condition that always holds', () => {
    expect(ALWAYS_TRUE_MEDIA).toBe('only screen and (min-width: 0px)');
  });
});

// Reading the source is the only way to pin the template side without booting
// the editor: what matters is that it no longer carries its own copy.
describe('both sides read the shared module', () => {
  const fs = require('fs');
  const path = require('path');

  it.each([
    'packages/editor/src/js/ext/badsender-screen-preview.js',
    'packages/editor/src/js/ext/head-css/scope-css.js',
    'packages/editor/src/js/ext/head-css/canvas-preview.js',
  ])('%s', (file) => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../..', file),
      'utf8'
    );
    expect(source).toMatch(/preview-media\.js'\)/);
    expect(source).not.toContain("'only screen and (min-width: 0px)'");
  });
});
