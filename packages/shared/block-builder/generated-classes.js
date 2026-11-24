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

// Every class the generator emits, and nothing else. A closed list rather than
// the prefix: the compiler exempts these from the check that a class must
// inline, so a typo (`lp-stak`) that matched a prefix would ship silently,
// with no rule behind it. A new behaviour adds its name here.
const GENERATED_CLASSES = Object.freeze([`${PREFIX}${STACK}`]);

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
 * @param {string} [behaviour] one of the behaviours GENERATED_CLASSES names
 * @returns {string}
 * @throws {Error} on a behaviour the list does not name — a code bug, checked
 *   whatever the column count so it cannot hide behind a one-column row. A
 *   behaviour read from stored state must be checked before it gets here.
 */
function stackClassFor(columnCount, behaviour = STACK) {
  const name = `${PREFIX}${behaviour}`;
  if (!isGeneratedClass(name)) {
    throw new Error(
      `block-builder: no generated class for the behaviour "${behaviour}". ` +
        `Expected one of ${GENERATED_CLASSES.join(', ')}.`
    );
  }
  if (!Number.isFinite(columnCount) || columnCount < 2) return '';
  return name;
}

module.exports = {
  GENERATED_CLASSES,
  isGeneratedClass,
  stackClassFor,
  STACK,
};
