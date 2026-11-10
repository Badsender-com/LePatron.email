'use strict';

/**
 * The words of the application in one language, for a mounted component:
 * `$t`, `$tc` and `$te` read the locale file and fill a sentence as vue-i18n
 * does, so a test reads what a person reads. A key with no entry is echoed
 * back, as vue-i18n does.
 *
 * - `$tc` picks between `singular | plural` as vue-i18n's default rule does:
 *   one is singular, any other count plural.
 *
 * @param {Object} messages a locale file's default export
 * @returns {{ $t: Function, $tc: Function, $te: Function }}
 */
const { get } = require('lodash');

const filled = (text, values = {}) =>
  text.replace(/\{(\w+)\}/g, (all, name) =>
    name in values ? String(values[name]) : all
  );

function wordsOf(messages) {
  const entry = (key) => {
    const text = get(messages, key);
    return typeof text === 'string' ? text : null;
  };
  const $t = (key, values) => {
    const text = entry(key);
    return text === null ? key : filled(text, values);
  };
  const $tc = (key, count, values = {}) => {
    const text = entry(key);
    if (text === null) return key;
    const choices = text.split('|').map((choice) => choice.trim());
    const choice =
      choices.length === 1 ? choices[0] : choices[count === 1 ? 0 : 1];
    return filled(choice, { count, ...values });
  };
  const $te = (key) => entry(key) !== null;
  return { $t, $tc, $te };
}

module.exports = { wordsOf };
