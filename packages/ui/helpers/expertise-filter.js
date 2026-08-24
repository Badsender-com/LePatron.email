// Pure helpers for the playground dynamic-expertise filter. Kept out of the
// component so the mapping (which drives the live preview request) is unit
// testable without a Vue mount.

// findApplicable requires a non-empty scope; the preview is gated on it.
export function hasFilterScope(filter) {
  const scope = filter && filter.scope;
  return Array.isArray(scope) && scope.length > 0;
}

// findApplicable ALSO requires at least one category — the preview is gated on
// both (an incomplete filter must not silently call the endpoint).
export function hasFilterCategories(filter) {
  const categories = filter && filter.categories;
  return Array.isArray(categories) && categories.length > 0;
}

// In filter mode, categories defaults to the selected skill's category. This is
// true whichever order the user picks (skill→mode or mode→skill): the rule is
// reactive, so it fires when mode becomes 'filter' OR when the skill category
// becomes known, as long as no category is set yet.
export function needsCategoryDefault(mode, skillCategory, filter) {
  return mode === 'filter' && !!skillCategory && !hasFilterCategories(filter);
}

// Turn a filter into the query params sent to the preview endpoint. Empty
// values are omitted so they don't over-constrain the count.
export function serialiseExpertiseFilter(filter) {
  const f = filter || {};
  const params = {};
  if (Array.isArray(f.scope) && f.scope.length) params.scope = f.scope;
  if (Array.isArray(f.categories) && f.categories.length) {
    params.categories = f.categories;
  }
  if (f.emailType) params.emailType = f.emailType;
  if (f.language) params.language = f.language;
  return params;
}

// Which expertise mode an existing scenario was saved in. THE single source of
// truth: the page used to carry its own copy that ignored `categories`, so a
// scenario filtering on categories alone came back as mode 'none' and the next
// save wiped the filter (review, `inferExpertiseMode` divergence). Explicit
// refs win over a filter — that ordering is the playground's policy, mirrored
// by expertise-resolver.service on the server.
export function inferExpertiseMode(scenario) {
  const s = scenario || {};
  if (Array.isArray(s.expertiseRefs) && s.expertiseRefs.length) {
    return 'explicit';
  }
  const filter = s.expertiseFilter || {};
  const hasAnyFilterValue =
    hasFilterScope(filter) ||
    hasFilterCategories(filter) ||
    !!filter.emailType ||
    !!filter.language;
  return hasAnyFilterValue ? 'filter' : 'none';
}
