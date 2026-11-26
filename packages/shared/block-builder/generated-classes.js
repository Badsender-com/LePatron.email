'use strict';

const { MAX_STACK_SPACING } = require('./row-spacing.js');

// The classes the generator owns.
//
// Everything a composed block needs is inlined, with one exception that cannot
// be: a rule that only applies inside a media query. `display:block` written
// inline would stack the columns on a desktop too — the whole point is that it
// applies below a width, and a `style` attribute cannot say that.
//
// So those few rules stay classes, and the markup and the stylesheet have to
// agree on their names. This module is where they agree, and it is also what
// the compiler reads to tell "a class we emit on purpose" from "a Tailwind
// utility that was supposed to be inlined and was not" — the second is a bug
// the build refuses, and only a list of the first tells the two apart.

// Prefixed so it reads as "LePatron put this here" wherever it turns up in a
// client's template. The prefix only names: the editor's own markers share it
// (`lp-bb-selected`, `lp-builder-block`), so it cannot tell a class the
// generator emits from anything else.
const PREFIX = 'lp-';

// How a column behaves on a phone. One value today — the columns stack — and
// the class is named after it rather than called "the stacking class", so a
// second behaviour is a second name and not a migration. The row object is
// where the setting that chooses between them will live.
const STACK = 'stack';

// The behaviours a column may have on a phone, and nothing else: what
// stackClassFor accepts. Its own list rather than GENERATED_CLASSES, which
// also names classes that are not a behaviour (`lp-gutter`).
const BEHAVIOURS = Object.freeze([STACK]);

// A cell that carries a desktop gutter. On a phone the columns take the full
// width, so the padding that made the gutter goes.
const GUTTER_CLASS = `${PREFIX}gutter`;

// The space under a stacked column, one class per value the stack spacing may
// take (row-spacing.js): every whole px from 1 to the maximum. Named by value,
// like the stacking class, so ten columns spaced alike are one rule. A value
// is never written into the stylesheet: it picks a name from this list, and
// the list is what the stylesheet is made of. Forty names, but a stylesheet
// only holds the rules its composition uses (stylesheet.js).
const STACK_SPACING_PREFIX = `${PREFIX}${STACK}-spacing-`;
const STACK_SPACINGS = Object.freeze(
  Array.from({ length: MAX_STACK_SPACING }, (_, index) => index + 1)
);

// Every class the generator emits, and nothing else. A closed list rather than
// the prefix: the compiler exempts these from the check that a class must
// inline, so a typo (`lp-stak`) that matched a prefix would ship silently,
// with no rule behind it. A new behaviour adds its name here.
const GENERATED_CLASSES = Object.freeze([
  `${PREFIX}${STACK}`,
  GUTTER_CLASS,
  ...STACK_SPACINGS.map((spacing) => `${STACK_SPACING_PREFIX}${spacing}`),
]);

// What each generated class does once the viewport is narrow enough: the body
// of its rule inside the stylesheet's media query (stylesheet.js). Kept next to
// the list so a new behaviour is one name there and one entry here, and a test
// refuses a name without its declarations.
//
// `!important` is not decoration. The cell carries its width as an inline
// style — Outlook reads the attribute, everything else reads the style — and
// a class on the same element still loses to an inline declaration without it.
// That is the mistake the spike made first, and it is invisible: the rule is
// there, the class is there, and nothing moves.
//
// The gutter and the stack spacing are padding, and the gutter's is inline on
// the cell for the same reason as the width. The stack spacing goes under a
// stacked column that has another one holding something after it, and only
// there (row-markup.js).
const MOBILE_DECLARATIONS = Object.freeze({
  [`${PREFIX}${STACK}`]: 'display:block !important;width:100% !important;',
  [GUTTER_CLASS]: 'padding-left:0 !important;padding-right:0 !important;',
  ...Object.fromEntries(
    STACK_SPACINGS.map((spacing) => [
      `${STACK_SPACING_PREFIX}${spacing}`,
      `padding-bottom:${spacing}px !important;`,
    ])
  ),
});

/**
 * @param {string} name a class name
 * @returns {boolean} whether the generator owns it
 */
function isGeneratedClass(name) {
  return GENERATED_CLASSES.includes(name);
}

/**
 * The class a column carries for its mobile behaviour, or '' when it has none.
 *
 * A row of one column has nothing to stack, and must not drag a rule into the
 * head of every mailing that holds a composed block.
 *
 * @param {number} columnCount how many columns the row holds
 * @param {string} [behaviour] one of BEHAVIOURS
 * @returns {string}
 * @throws {Error} on a behaviour the list does not name — a code bug, checked
 *   whatever the column count so it cannot hide behind a one-column row. A
 *   behaviour read from stored state must be checked before it gets here.
 */
function stackClassFor(columnCount, behaviour = STACK) {
  if (!BEHAVIOURS.includes(behaviour)) {
    throw new Error(
      `block-builder: no generated class for the behaviour "${behaviour}". ` +
        `Expected one of ${BEHAVIOURS.join(', ')}.`
    );
  }
  if (!Number.isFinite(columnCount) || columnCount < 2) return '';
  return `${PREFIX}${behaviour}`;
}

/**
 * The class a cell carries for the gutter before it, or '' for none.
 *
 * @param {number} gutter normalised (row-spacing.js)
 * @returns {string}
 */
const gutterClassFor = (gutter) => (gutter > 0 ? GUTTER_CLASS : '');

/**
 * The class a stacked column carries to keep this space under it, or '' for
 * none.
 *
 * @param {number} spacing normalised (row-spacing.js)
 * @returns {string}
 * @throws {Error} on a spacing the list has no class for — a value that did
 *   not go through normaliseStackSpacing, which is a code bug
 */
function stackSpacingClassFor(spacing) {
  if (spacing === 0) return '';
  const name = `${STACK_SPACING_PREFIX}${spacing}`;
  if (!isGeneratedClass(name)) {
    throw new Error(
      `block-builder: no generated class for a stack spacing of "${spacing}". ` +
        'Normalise it first (row-spacing.js).'
    );
  }
  return name;
}

module.exports = {
  BEHAVIOURS,
  GENERATED_CLASSES,
  GUTTER_CLASS,
  STACK_SPACINGS,
  gutterClassFor,
  stackSpacingClassFor,
  MOBILE_DECLARATIONS,
  isGeneratedClass,
  stackClassFor,
  STACK,
};
