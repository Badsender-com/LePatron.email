import {
  activeFiltersCount,
  hasActiveFilters,
  isSearchingAll,
  searchPagination,
} from '~/utils/mailing-search.js';

// The "all my workspaces" search scope of the email listing (epic #1144,
// ADR 0007).

const NO_FILTER = {
  name: '',
  templates: [],
  tags: [],
  createdAtStart: '',
  createdAtEnd: '',
  updatedAtStart: '',
  updatedAtEnd: '',
};

describe('the search scope of the email listing', () => {
  it.each([
    [{ scope: 'all' }, true],
    [{ scope: 'all', wid: 'w1' }, true],
    [{ wid: 'w1' }, false],
    [undefined, false],
  ])('reads %o as searching every workspace: %p', (query, expected) => {
    expect(isSearchingAll(query)).toBe(expected);
  });

  it('counts the filters that narrow the list', () => {
    expect(activeFiltersCount(NO_FILTER)).toBe(0);
    expect(hasActiveFilters(NO_FILTER)).toBe(false);
    expect(
      activeFiltersCount({
        ...NO_FILTER,
        name: 'spring',
        tags: ['promo', 'b2b'],
        updatedAtStart: '2026-10-01',
      })
    ).toBe(3);
  });

  it.each([
    [25, 25],
    [100, 100],
    [-1, 100],
    [250, 100],
  ])('asks a page size of %p as %p', (kept, sent) => {
    expect(searchPagination({ page: 2, itemsPerPage: kept })).toEqual({
      page: 2,
      itemsPerPage: sent,
    });
  });
});
