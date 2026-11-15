/**
 * The dimensions suggested to a company with none of its own (ADR-0026): the
 * usual ways to decline emails. A suggestion prefills the creation and
 * creates nothing; a name already taken is not offered, nor a role another
 * dimension holds. Covered by tests/ui/helpers/taxonomy-suggestions.test.js.
 */

const SUGGESTIONS = Object.freeze([
  { name: 'market', role: 'country', parentName: null },
  { name: 'language', role: 'language', parentName: 'market' },
  { name: 'brand', role: null, parentName: null },
  { name: 'audience', role: null, parentName: null },
]);

/**
 * @param {Object[]} dimensions the company's, standard ones included
 * @returns {Array<{name: string, labelKey: string, role: string|null, parentName: string|null}>}
 *   in the order of the path; `parentName` only when that dimension exists
 */
export function suggestedDimensions(dimensions = []) {
  const names = new Set(dimensions.map((dimension) => dimension.name));
  const roles = new Set(
    dimensions.map((dimension) => dimension.role).filter(Boolean)
  );
  return SUGGESTIONS.filter((suggestion) => !names.has(suggestion.name)).map(
    (suggestion) => ({
      name: suggestion.name,
      labelKey: `taxonomy.workspace.start.suggestions.${suggestion.name}`,
      role:
        suggestion.role && !roles.has(suggestion.role) ? suggestion.role : null,
      parentName:
        suggestion.parentName && names.has(suggestion.parentName)
          ? suggestion.parentName
          : null,
    })
  );
}

/**
 * @param {Object[]} dimensions
 * @returns {boolean} whether the company has declared none of its own
 */
export function hasNoCompanyDimension(dimensions = []) {
  return !dimensions.some((dimension) => !dimension.standard);
}
