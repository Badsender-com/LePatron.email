import {
  ROLES,
  LANGUAGE_CODES,
  COUNTRY_CODES,
  splitLocale,
  joinLocale,
} from '../../shared/locale/locale-codes.js';

/**
 * Pure helpers for the dimension roles and the normalised codes of the taxonomy
 * screen (ADR-0023), covered by tests/ui/helpers/taxonomy-roles.test.js. The
 * lists and the locale rule are shared with the server and the editor.
 */

export { splitLocale, joinLocale };

/**
 * The roles a dimension may take: those no other dimension of the company
 * holds, a deactivated one included, and the one it holds already. None for a
 * standard dimension.
 *
 * @param {Object[]} dimensions every dimension of the company
 * @param {Object} dimension the one being edited; `{}` for a new one
 * @returns {string[]}
 */
export function roleOptions(dimensions = [], dimension = {}) {
  if (dimension.standard) return [];
  const taken = new Set(
    dimensions
      .filter((other) => other.name !== dimension.name && other.role)
      .map((other) => other.role)
  );
  return ROLES.filter((role) => !taken.has(role));
}

/**
 * The codes a value of a dimension with `role` may take, named in `lang` and
 * sorted by name. A `locale` is picked as a language and a country: see
 * splitLocale.
 *
 * @param {string} role `language` or `country`
 * @param {string} lang the reader's language
 * @returns {Array<{value: string, text: string}>}
 */
export function codeOptions(role, lang) {
  const isCountry = role === 'country';
  const codes = isCountry ? COUNTRY_CODES : LANGUAGE_CODES;
  const names = new Intl.DisplayNames([lang], {
    type: isCountry ? 'region' : 'language',
  });
  const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  return codes
    .map((code) => ({
      value: code,
      text: `${capitalise(names.of(code) || code)} (${code})`,
    }))
    .sort((a, b) => a.text.localeCompare(b.text, lang));
}

/**
 * How many values lack a code, shown on the card of a dimension with a role.
 *
 * @param {Object[]} values
 * @returns {number}
 */
export function valuesWithoutCode(values = []) {
  return values.filter((value) => !value.code).length;
}
