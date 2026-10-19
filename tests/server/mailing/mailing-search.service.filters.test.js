'use strict';

// Searching every accessible workspace (epic #1144, ADR 0007): the filters
// and the sort of the folder listing work the same in this scope, and every
// result is paginated, 100 emails a page at most, without "All".
//
// The models are in-memory fakes that answer a query as Mongoose and MongoDB
// would (tests/helpers/fake-listing-models.js); the data set is in
// mailing-search.fixtures.js.

const { createListingStore } = require('../../helpers/fake-listing-models.js');
const {
  TEMPLATE_PROMO,
  NEWSLETTERS,
  mailing,
  inClient,
  seed,
  frank,
  companyAdmin,
  BY_NAME,
  names,
} = require('./mailing-search.fixtures.js');

const mockStore = createListingStore();

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('./mailing-search.fixtures.js').modelsOver(mockStore)
);
jest.mock('../../../packages/server/template/template.service.js', () => ({}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

let searchMailings;
function search(user, { filters = {}, pagination = BY_NAME } = {}) {
  return searchMailings({ user, filters, pagination });
}

// Turned on by #1314 (search every accessible workspace)
describe.skip('searching every accessible workspace, its filters and pages', () => {
  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist
    // until #1314 ships it, and a top-level require would break the suite.
    ({
      searchMailings,
    } = require('../../../packages/server/mailing/mailing-search.service'));
  });

  beforeEach(() => seed(mockStore));

  describe('the listing filters and sort', () => {
    it('matches the name anywhere in it, whatever the case', async () => {
      const result = await search(companyAdmin, { filters: { name: 'EASE' } });

      expect(names(result)).toEqual(['Spring teaser']);
    });

    it('matches the name literally, not as a pattern', async () => {
      const result = await search(companyAdmin, { filters: { name: '.*' } });

      expect(names(result)).toEqual([]);
    });

    it('filters by template', async () => {
      const result = await search(companyAdmin, {
        filters: { templates: [TEMPLATE_PROMO] },
      });

      expect(names(result)).toEqual(['Spring archive', 'Spring promo']);
    });

    it('filters by tag', async () => {
      const result = await search(companyAdmin, {
        filters: { tags: ['promo'] },
      });

      expect(names(result)).toEqual(['Spring promo', 'Spring sale']);
    });

    it('filters by update date, the end date excluded', async () => {
      const result = await search(companyAdmin, {
        filters: { updatedAtStart: '2026-09-01', updatedAtEnd: '2026-09-20' },
      });

      expect(names(result)).toEqual(['Spring teaser']);
    });

    it('filters by creation date', async () => {
      const result = await search(companyAdmin, {
        filters: { createdAtStart: '2025-01-01', createdAtEnd: '2026-01-01' },
      });

      expect(names(result)).toEqual(['Spring archive']);
    });

    it.each([
      ['no sort', {}],
      ['an empty sort', { sortBy: [], sortDesc: [] }],
    ])(
      'lists the most recently updated emails first when %s is asked',
      async (_, pagination) => {
        const result = await search(companyAdmin, { pagination });

        expect(names(result)).toEqual([
          'Weekly news',
          'Spring sale',
          'Spring teaser',
          'Spring promo',
          'Spring old',
          'Spring archive',
        ]);
      }
    );
  });

  describe('pages', () => {
    // 130 emails in Newsletters.
    const many = Array.from({ length: 130 }, (_, index) =>
      mailing(
        `News ${String(index + 1).padStart(3, '0')}`,
        inClient({ _workspace: NEWSLETTERS })
      )
    );

    beforeEach(() => seed(mockStore, { mailings: many }));

    it('holds 25 emails when no page size is asked', async () => {
      const result = await search(frank, { pagination: {} });

      expect(result.items.docs).toHaveLength(25);
      expect(result.items.totalDocs).toBe(130);
    });

    it('holds at most 100 emails, whatever page size is asked', async () => {
      const result = await search(frank, {
        pagination: { ...BY_NAME, page: 1, itemsPerPage: 250 },
      });

      expect(result.items.docs).toHaveLength(100);
      expect(result.items.limit).toBe(100);
      expect(result.items.totalDocs).toBe(130);
    });

    it('serves the next pages', async () => {
      const result = await search(frank, {
        pagination: { ...BY_NAME, page: 2, itemsPerPage: 100 },
      });

      expect(result.items.docs).toHaveLength(30);
      expect(result.items.docs[0].name).toBe('News 101');
    });

    // INVALID_PAGE_SIZE is a code #1314 adds to the error codes.
    it('refuses "All": every email in one page', async () => {
      await expect(
        search(frank, {
          pagination: { ...BY_NAME, page: 1, itemsPerPage: -1 },
        })
      ).rejects.toMatchObject({ status: 400, message: 'INVALID_PAGE_SIZE' });
    });
  });
});
