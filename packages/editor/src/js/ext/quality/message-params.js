'use strict';

// The parameters a finding or a passed check quotes, written for its reader:
// rules give raw values, the drawer shows them in the language of the page
// (1,4 in French, 1.4 in English, 1 Mo rather than 1024 Ko).

/**
 * The language of the page the editor runs in (html lang, set by the server
 * from the user's locale), or undefined: the browser's own.
 * @returns {string|undefined}
 */
function pageLocale() {
  return (
    (typeof document !== 'undefined' && document.documentElement.lang) ||
    undefined
  );
}

/**
 * A weight in KB that a message quotes with its unit: in MB when it is a
 * whole number of them (a threshold of 1024 KB reads "1 MB"), in KB otherwise.
 * @param {number} kb
 * @returns {{ kb: number }}
 */
const kbSize = (kb) => Object.freeze({ kb });

const isKbSize = (value) =>
  Boolean(value) && typeof value === 'object' && typeof value.kb === 'number';

const KB_PER_MB = 1024;

// The words around a number are the translations' ("1 Mo" in French).
const untranslated = (key, params) =>
  Object.keys(params).reduce(
    (text, name) => text.replace(`__${name}__`, params[name]),
    key
  );

// One formatter per language: the drawer formats every row of every run.
const formatters = new Map();
function numberFormat(locale) {
  const key = locale || '';
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
    );
  }
  return formatters.get(key);
}

/**
 * @param {Object} params - what the rule quotes
 * @param {Object} options
 * @param {string} [options.locale] - BCP 47 language of the reader, the
 *   page's by default
 * @param {Function} [options.t] - translation, for the units of a weight
 * @returns {Object} the same parameters, numbers written for the reader
 */
function formatParams(
  params,
  { locale = pageLocale(), t = untranslated } = {}
) {
  const numbers = numberFormat(locale);
  const format = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return numbers.format(value);
    }
    if (!isKbSize(value)) return value;
    const { kb } = value;
    return kb > 0 && kb % KB_PER_MB === 0
      ? t('__size__ MB', { size: numbers.format(kb / KB_PER_MB) })
      : t('__size__ KB', { size: numbers.format(kb) });
  };
  return Object.fromEntries(
    Object.entries(params || {}).map(([name, value]) => [name, format(value)])
  );
}

module.exports = { pageLocale, kbSize, formatParams };
