// Pure helpers for the playground dynamic-expertise filter. Kept out of the
// component so the mapping (which drives the live preview request) is unit
// testable without a Vue mount.

// findApplicable requires a non-empty scope; the preview is gated on it.
export function hasFilterScope(filter) {
  const scope = filter && filter.scope;
  return Array.isArray(scope) && scope.length > 0;
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
