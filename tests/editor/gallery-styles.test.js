'use strict';

// The gallery panel's stylesheets, compiled with the LESS the build uses
// (gulp-less's own): what a rule does is only readable once the tokens are
// resolved.
const path = require('path');
const postcss = require('postcss');

const less = require(require.resolve('less', {
  paths: [path.dirname(require.resolve('gulp-less'))],
}));

const CSS_DIR = path.join(__dirname, '../../packages/editor/src/css');

let root;

beforeAll(async () => {
  // style_variables.less first, as badsender-editor.less imports it
  const { css } = await less.render(
    [
      '@import "style_variables.less";',
      '@import "gallery-vue-panel.less";',
      '@import "gallery-vue-thumb.less";',
    ].join('\n'),
    { paths: [CSS_DIR] }
  );
  root = postcss.parse(css);
});

// the values `prop` takes in the rules written for exactly `selector`
function valuesOf(selector, prop) {
  const values = [];
  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls(prop, (decl) => values.push(decl.value));
  });
  return values;
}

describe('gallery styles — the thumbnail’s ✕', () => {
  // Faded out, it still took clicks: on a touch screen, with no hover to
  // reveal it, a tap in the corner deleted the image without a word.
  it('takes no click until the thumbnail is hovered', () => {
    expect(valuesOf('.gallery-thumb__remove', 'opacity')).toEqual(['0']);
    expect(valuesOf('.gallery-thumb__remove', 'pointer-events')).toEqual([
      'none',
    ]);
    const hovered = '.gallery-thumb:hover .gallery-thumb__remove';
    expect(valuesOf(hovered, 'opacity')).toEqual(['1']);
    expect(valuesOf(hovered, 'pointer-events')).toEqual(['auto']);
  });
});
