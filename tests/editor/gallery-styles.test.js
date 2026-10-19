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
// the brand colours of style_variables.less, used when no brand is injected
const DEFAULT_PRIMARY = '#093040';
const DEFAULT_ACCENT = '#00acdc';

let root;
let compiled;

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
  compiled = css;
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

// the last compound of a selector, the element its rule styles
function subjectOf(selector) {
  return selector.split(/\s*[\s>+~]\s*/).pop();
}

// the selectors of the rules that set `prop` to `value` on `target`
function selectorsSetting(target, prop, value) {
  const selectors = [];
  root.walkRules((rule) => {
    rule.walkDecls(prop, (decl) => {
      if (decl.value !== value) return;
      rule.selectors
        .filter((selector) => subjectOf(selector).startsWith(target))
        .forEach((selector) => selectors.push(selector));
    });
  });
  return selectors;
}

describe('gallery styles — the thumbnail’s action bar', () => {
  // The bar sits at the bottom of the image. Faded out, it must not take the
  // tap meant to insert the image: on a touch screen nothing is hovered.
  it('takes no click until it is revealed', () => {
    expect(valuesOf('.gallery-thumb__actions', 'pointer-events')).toEqual([
      'none',
    ]);
    const clickable = selectorsSetting(
      '.gallery-thumb__actions',
      'pointer-events',
      'auto'
    ).map((selector) => selector.replace(/ \.gallery-thumb__actions$/, ''));
    const shown = selectorsSetting('.gallery-thumb__overlay', 'opacity', '1');
    expect(clickable.length).toBeGreaterThan(0);
    expect(clickable.sort()).toEqual(shown.sort());
  });

  // The gallery stays open after an image is inserted, and a click leaves
  // the focus on the image. Revealed on any focus in the thumbnail, the bar
  // stayed up and clickable there while the pointer was over another one,
  // and followed the cell when the scroller recycled it. The bar's own
  // buttons take no focus from a click (gallery-thumb-actions.test.js).
  it('is revealed by a keyboard focus, not by a click', () => {
    const shown = selectorsSetting('.gallery-thumb__overlay', 'opacity', '1');
    expect(shown.sort()).toEqual(
      [
        '.gallery-thumb:hover .gallery-thumb__overlay',
        '.gallery-thumb__img:focus-visible + .gallery-thumb__overlay',
        '.gallery-thumb__overlay:focus-within',
      ].sort()
    );
  });

  // The scrim darkens the image under the bar: were it to take the pointer, it
  // would be a transparent lid that stops the thumbnail from being dragged.
  it('never lets the scrim take the pointer', () => {
    expect(valuesOf('.gallery-thumb__overlay', 'pointer-events')).toEqual([
      'none',
    ]);
    expect(
      selectorsSetting('.gallery-thumb__overlay', 'pointer-events', 'auto')
    ).toEqual([]);
  });

  // The old ✕ deleted with no confirmation; the bar's trash asks first, so a
  // tap that lands on it on a touch screen (where :hover sticks) is harmless.
  it('replaces the ✕ of the grid', () => {
    expect(valuesOf('.gallery-thumb__remove', 'opacity')).toEqual([]);
  });
});

describe('gallery styles — a button that is working', () => {
  const busy = ".gallery-thumb__action[aria-busy='true']";

  it('says the click was taken while the image editor opens', () => {
    expect(valuesOf(busy, 'cursor')).toEqual(['progress']);
    expect(valuesOf(`${busy} .lucide`, 'animation')).toHaveLength(2);
  });

  it('keeps still for whoever asked for less motion', () => {
    const still = [];
    root.walkRules((rule) => {
      if (!rule.selectors.includes(`${busy} .lucide`)) return;
      if (rule.parent.type !== 'atrule') return;
      rule.walkDecls('animation', (decl) => still.push(decl.value));
    });
    expect(still).toEqual(['none']);
  });
});

describe('gallery styles — brand colours', () => {
  // The editor injects the brand as --v-primary-base / --v-accent-base
  // (mosaico-editor.pug), and the tabs right above the panel read them.
  it('reads the brand at runtime, the default brand only as fallback', () => {
    const themed = [
      `var(--v-primary-base, ${DEFAULT_PRIMARY})`,
      `var(--v-accent-base, ${DEFAULT_ACCENT})`,
    ];
    const frozen = [];
    root.walkDecls((decl) => {
      const rest = themed.reduce(
        (value, fallback) => value.split(fallback).join(''),
        decl.value.toLowerCase()
      );
      if (rest.includes(DEFAULT_PRIMARY) || rest.includes(DEFAULT_ACCENT)) {
        frozen.push(`${decl.parent.selector} { ${decl.prop}: ${decl.value} }`);
      }
    });
    expect(frozen).toEqual([]);
  });

  it('colours the active chip with the brand', () => {
    expect(valuesOf('.gallery-vue-chip--active', 'background')).toEqual([
      `var(--v-primary-base, ${DEFAULT_PRIMARY})`,
    ]);
  });
});

describe('gallery styles — the build', () => {
  // gulpfile.js (cssDev, cssProd) runs the stylesheet through these, with
  // these options. On a rule it cannot parse (a `:has()` in `@supports`)
  // autoprefixer throws, the build writes no stylesheet at all, and still
  // reports success.
  it('goes through the build’s autoprefixer and minifier', async () => {
    const autoprefixer = require('autoprefixer');
    const csswring = require('csswring');
    const buildPostcss = require(require.resolve('postcss', {
      paths: [path.dirname(require.resolve('autoprefixer'))],
    }));
    const prefixed = await buildPostcss([
      autoprefixer({ overrideBrowserslist: ['ie 10', 'last 2 versions'] }),
    ]).process(compiled, { from: undefined });
    const minified = await buildPostcss([
      csswring({ removeAllComments: true }),
    ]).process(prefixed.css, { from: undefined });
    expect(minified.css).toContain('.gallery-thumb__overlay');
  });
});
