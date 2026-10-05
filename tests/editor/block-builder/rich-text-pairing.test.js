'use strict';

// TinyMCE decides what a writer can produce; the sanitiser decides what the
// generator keeps. If the first is wider than the second, someone styles a
// word, sees it in the editor, and loses it on apply — which reads as data loss
// rather than as a rule.
//
// The two lists are written separately on purpose: making the editor bundle
// import the generator for six tag names would pull the whole thing in. This
// file is what keeps them honest instead.

const {
  VALID_ELEMENTS,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/rich-text-field.js');
const {
  ALLOWED,
  sanitizeRichText,
} = require('../../../packages/shared/block-builder/rich-text.js');

/**
 * `strong/b,em/i,u,a[href],br` ->
 *   { strong: [], b: [], em: [], i: [], u: [], a: ['href'], br: [] }
 *
 * `strong/b` declares two tags sharing one rule, as TinyMCE reads it.
 */
function rulesOf(validElements) {
  return validElements.split(',').reduce((rules, rule) => {
    const match = /^([^[]+)(?:\[([^\]]*)\])?$/.exec(rule.trim());
    const attributes = match[2] ? match[2].split('|').filter(Boolean) : [];
    match[1].split('/').forEach((tag) => {
      rules[tag.trim()] = attributes;
    });
    return rules;
  }, {});
}

const tagsOf = (validElements) => Object.keys(rulesOf(validElements));

describe('the editor and the sanitiser agree', () => {
  it('every tag TinyMCE may produce survives the sanitiser', () => {
    tagsOf(VALID_ELEMENTS).forEach((tag) => {
      expect(Object.prototype.hasOwnProperty.call(ALLOWED, tag)).toBe(true);
    });
  });

  it('every tag the sanitiser keeps can be produced', () => {
    const editable = new Set(tagsOf(VALID_ELEMENTS));

    Object.keys(ALLOWED).forEach((tag) => {
      expect(editable.has(tag)).toBe(true);
    });
  });

  // Same rule for attributes: one TinyMCE lets through and the sanitiser drops
  // — a link's `target` — reads as a setting that does not stick.
  it.each(Object.keys(ALLOWED))('allows the same attributes on %s', (tag) => {
    expect(rulesOf(VALID_ELEMENTS)[tag].slice().sort()).toEqual(
      ALLOWED[tag].attributes.slice().sort()
    );
  });

  // The attribute that can execute, and the only one on either list.
  it('allows href on links, on both sides', () => {
    expect(rulesOf(VALID_ELEMENTS).a).toContain('href');
    expect(ALLOWED.a.attributes).toContain('href');
  });

  // A round trip through the sanitiser must not change what the editor emits,
  // or the preview would drift from the panel on every keystroke.
  it('leaves typical editor output untouched', () => {
    const typical =
      "Du <strong>gras</strong>, de l'<em>italique</em>, " +
      '<u>souligné</u>, un <a href="https://e.com">lien</a><br />et une suite.';

    expect(sanitizeRichText(typical)).toBe(typical);
  });
});
