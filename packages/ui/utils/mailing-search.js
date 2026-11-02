// The "all my workspaces" search scope of the email listing (ADR 0007), as
// the `scope` query of the listing's route. Its pages hold 100 emails at
// most, without "All".

export const SEARCH_SCOPE_ALL = 'all';
export const SEARCH_MAX_PAGE_SIZE = 100;

export function isSearchingAll(query) {
  return query?.scope === SEARCH_SCOPE_ALL;
}

/**
 * @param {Object} filters the listing's filters
 * @returns {number} how many narrow the emails: a name, a template list, a
 *   tag list, a date
 */
export function activeFiltersCount(filters = {}) {
  return Object.values(filters).filter((value) =>
    Array.isArray(value) ? value.length > 0 : !!value
  ).length;
}

export function hasActiveFilters(filters) {
  return activeFiltersCount(filters) > 0;
}

// The page size kept from the current folder, within what the search serves.
export function searchPagination(pagination) {
  const { itemsPerPage } = pagination;
  return itemsPerPage > 0 && itemsPerPage <= SEARCH_MAX_PAGE_SIZE
    ? pagination
    : { ...pagination, itemsPerPage: SEARCH_MAX_PAGE_SIZE };
}
