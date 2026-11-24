'use strict';

const { MOBILE_DECLARATIONS } = require('./generated-classes.js');
const { rowClass, BLOCK_WIDTH } = require('./row-markup.js');

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
// the recomputed value from sharing one shape. What keeps them in step is that
// both ask rowClass (row-markup.js) which class a row carries.
//
// Never stored. It is recomputed wherever the composition is rendered, which
// is also why a block saved to the library needs nothing extra to keep
// stacking in another mailing: there is nothing to carry.

// Where a phone stops being a desktop, for this stylesheet: the width the
// composition is laid out at. Below it, a two-column row has less than half of
// it a side, and nothing worth reading fits.
const BREAKPOINT = BLOCK_WIDTH;

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
    const name = rowClass(row);
    if (name !== '') found.add(name);
    return found;
  }, new Set());

  return [...names];
}

/**
 * The stylesheet for a set of generated classes, as one block of rules.
 *
 * @param {Iterable<string>} names generated class names (GENERATED_CLASSES)
 * @returns {string} one media query holding a rule per class, or ''
 */
function cssForClasses(names) {
  const rules = [...new Set(names)].map(
    (name) => `.${name}{${MOBILE_DECLARATIONS[name]}}`
  );

  if (rules.length === 0) return '';

  return `@media only screen and (max-width:${BREAKPOINT}px){${rules.join(
    ''
  )}}`;
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
  return cssForClasses(
    (compositions || []).reduce(
      (names, composition) => names.concat(classesOf(composition)),
      []
    )
  );
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
  cssForClasses,
  BREAKPOINT,
};
