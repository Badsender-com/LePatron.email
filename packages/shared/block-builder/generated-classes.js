'use strict';

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
// the build refuses, and without a prefix the two are indistinguishable.

// Short, and already used by the editor for the markers it owns. It reads as
// "LePatron put this here" wherever it turns up in a client's template.
const GENERATED_CLASS_PREFIX = 'lp-';

/**
 * @param {string} name a class name
 * @returns {boolean} whether the generator owns it
 */
function isGeneratedClass(name) {
  return typeof name === 'string' && name.startsWith(GENERATED_CLASS_PREFIX);
}

// How a column behaves on a phone. One value today — the columns stack — and
// the class is named after it rather than called "the stacking class", so a
// second behaviour is a second name and not a migration. The row object is
// where the setting that chooses between them will live.
const STACK = 'stack';

/**
 * The class a column carries for its mobile behaviour, or '' when it has none.
 *
 * A row of one column has nothing to stack, and must not drag a rule into the
 * head of every mailing that holds a composed block.
 *
 * @param {number} columnCount how many columns the row holds
 * @param {string} [behaviour]
 * @returns {string}
 */
function stackClassFor(columnCount, behaviour = STACK) {
  if (!Number.isFinite(columnCount) || columnCount < 2) return '';
  return `${GENERATED_CLASS_PREFIX}${behaviour}`;
}

module.exports = {
  GENERATED_CLASS_PREFIX,
  isGeneratedClass,
  stackClassFor,
  STACK,
};
