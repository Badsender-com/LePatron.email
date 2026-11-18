'use strict';

// The parameters a finding or a passed check quotes, written for its reader:
// rules give raw values, the drawer shows them in the language of the page
// (1,4 in French, 1.4 in English).

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
 * @param {Object} params - what the rule quotes
 * @param {Object} options
 * @param {string} [options.locale] - BCP 47 language of the reader, the
 *   page's by default
 * @returns {Object} the same parameters, numbers written for the reader
 */
function formatParams(params, { locale = pageLocale() } = {}) {
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return Object.fromEntries(
    Object.entries(params || {}).map(([name, value]) => [
      name,
      typeof value === 'number' && Number.isFinite(value)
        ? numbers.format(value)
        : value,
    ])
  );
}

module.exports = { pageLocale, formatParams };
