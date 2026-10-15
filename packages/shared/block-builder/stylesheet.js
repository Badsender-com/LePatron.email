'use strict';

const { stackClassFor } = require('./generated-classes.js');

// The stylesheet a composition derives.
//
// Everything a composed block needs is inlined, with one exception that cannot
// be: a rule that only applies below a width. `display:block` written inline
// would stack the columns on a desktop too — the whole point is that it holds
// only inside a media query, and a `style` attribute cannot say that.
//
// A SECOND derivation from the same composition, not a second return value of
// the generator. Two of the generator's callers compare its result against the
// stored markup to detect an altered block, and those comparisons have to stay
// markup-to-markup. Keeping the two apart also keeps the frozen artifact and
// the recomputed value from sharing one shape.
//
// Never stored. It is recomputed wherever the composition is rendered, which
// is also why a block saved to the library needs nothing extra to keep
// stacking in another mailing: there is nothing to carry.

// Where a phone stops being a desktop, for this stylesheet. 600px because that
// is the width the composition is laid out at: below it, a two-column row has
// less than 300px a side, and nothing worth reading fits.
const BREAKPOINT = 600;

// What each behaviour does once the viewport is narrow enough.
//
// `!important` is not decoration. The cell carries its width as an inline
// style — Outlook reads the attribute, everything else reads the style — and
// a class on the same element still loses to an inline declaration without it.
// That is the mistake the spike made first, and it is invisible: the rule is
// there, the class is there, and nothing moves.
const BEHAVIOURS = {
  stack: 'display:block !important;width:100% !important;',
};

/**
 * Every class a composition's rows ask for, in the order they first appear.
 *
 * Named by value and deduplicated: ten columns behaving the same way are one
 * rule, because the same behaviour always produces the same name.
 *
 * @param {Object} composition
 * @returns {Array<string>} class names, each once
 */
function classesOf(composition) {
  const rows =
    composition && Array.isArray(composition.rows) ? composition.rows : [];

  const names = rows.reduce((found, row) => {
    const columns = row && Array.isArray(row.columns) ? row.columns : [];
    // A row of one column has nothing to stack, and must not drag a media
    // query into the head of every mailing that holds a composed block.
    const name = stackClassFor(columns.length);
    if (name !== '') found.add(name);
    return found;
  }, new Set());

  return [...names];
}

/**
 * The stylesheet SEVERAL compositions need, as one block of rules.
 *
 * A mailing holds as many composed blocks as its author wants, and two of them
 * with columns behave the same way. Collecting across all of them before
 * emitting is what keeps that one rule rather than one per block — the same
 * reason the class is named by value in the first place.
 *
 * @param {Array<Object>} compositions
 * @returns {string}
 */
function collectCssFor(compositions) {
  const names = (compositions || []).reduce((found, composition) => {
    classesOf(composition).forEach((name) => found.add(name));
    return found;
  }, new Set());

  const rules = [...names]
    .map((name) => {
      // The behaviour is the part of the name after the prefix, which is how
      // the name stays a value rather than a label: a second behaviour is a
      // second entry here and a second name there, with nothing to migrate.
      const behaviour = name.replace(/^lp-/, '');
      const declarations = BEHAVIOURS[behaviour];
      return declarations ? `.${name}{${declarations}}` : '';
    })
    .filter(Boolean);

  if (rules.length === 0) return '';

  return `@media only screen and (max-width:${BREAKPOINT}px){${rules.join(
    ''
  )}}`;
}

/**
 * The stylesheet one composition needs, or an empty string when it needs none.
 *
 * @param {Object} composition
 * @returns {string}
 */
function collectCss(composition) {
  return collectCssFor([composition]);
}

module.exports = {
  collectCss,
  collectCssFor,
  classesOf,
  BREAKPOINT,
  BEHAVIOURS,
};
