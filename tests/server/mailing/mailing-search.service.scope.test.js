'use strict';

// Searching every accessible workspace (epic #1144, ADR 0007): the search looks through every email of the user's accessible workspaces, in any folder or subfolder, within their group (the selected group for a super admin). The database applies the rights on the explicit list of accessible locations: nothing from another workspace comes back, not even in the count.
//
// The models are in-memory fakes that answer a filter as MongoDB would
// (tests/helpers/fake-listing-models.js); the data set is in
// mailing-search.fixtures.js.

const { createListingStore } = require('../../helpers/fake-listing-models.js');
const {
  CLIENT_GROUP,
  OTHER_GROUP,
  NEWSLETTERS,
  PROMOTIONS,
  YEAR_2026,
  SPRING,
  ARCHIVE,
  seed,
  frank,
  companyAdmin,
  superAdmin,
  bootstrapAccount,
  BY_NAME,
  names,
  docNamed,
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
describe.skip('searching every accessible workspace, its scope', () => {
  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist
    // until #1314 ships it, and a top-level require would break the suite.
    ({
      searchMailings,
    } = require('../../../packages/server/mailing/mailing-search.service'));
  });

  beforeEach(() => seed(mockStore));

  describe('which emails come back', () => {
    it('finds the emails of the workspaces a user is a member of, in any folder or subfolder', async () => {
      const result = await search(frank, { filters: { name: 'spring' } });

      expect(names(result)).toEqual(['Spring sale', 'Spring teaser']);
    });

    it('never returns an email of a workspace the user cannot access, nor counts it', async () => {
      const result = await search(frank);

      expect(names(result)).toEqual([
        'Spring sale',
        'Spring teaser',
        'Weekly news',
      ]);
      expect(result.items.totalDocs).toBe(3);
    });

    it('covers every workspace of the group for a company admin', async () => {
      const result = await search(companyAdmin);

      expect(names(result)).toEqual([
        'Spring archive',
        'Spring promo',
        'Spring sale',
        'Spring teaser',
        'Weekly news',
      ]);
    });

    it('covers every workspace of the group for a regular user when the group opens all workspaces to its users', async () => {
      seed(mockStore, { openWorkspaces: true });

      const result = await search(frank);

      expect(names(result)).toEqual([
        'Spring archive',
        'Spring promo',
        'Spring sale',
        'Spring teaser',
        'Weekly news',
      ]);
    });

    it('never returns an email whose location is gone', async () => {
      const result = await search(companyAdmin, {
        filters: { name: 'orphan' },
      });

      expect(names(result)).toEqual([]);
      expect(result.items.totalDocs).toBe(0);
    });

    it('limits a super admin to the selected group', async () => {
      const inClientGroup = await search(superAdmin(CLIENT_GROUP), {
        filters: { name: 'spring' },
      });
      const inOtherGroup = await search(superAdmin(OTHER_GROUP), {
        filters: { name: 'spring' },
      });

      expect(names(inClientGroup)).toEqual([
        'Spring archive',
        'Spring promo',
        'Spring sale',
        'Spring teaser',
      ]);
      expect(names(inOtherGroup)).toEqual(['Spring elsewhere']);
    });

    it('refuses the bootstrap account, which stays in the settings', async () => {
      await expect(search(bootstrapAccount)).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  describe('what each email says', () => {
    it('gives its location: workspace, folder, subfolder', async () => {
      const result = await search(companyAdmin);

      expect(docNamed(result, 'Weekly news').location).toEqual({
        workspace: { id: NEWSLETTERS, name: 'Newsletters' },
      });
      expect(docNamed(result, 'Spring sale').location).toEqual({
        workspace: { id: NEWSLETTERS, name: 'Newsletters' },
        folder: { id: YEAR_2026, name: '2026' },
      });
      expect(docNamed(result, 'Spring teaser').location).toEqual({
        workspace: { id: NEWSLETTERS, name: 'Newsletters' },
        folder: { id: YEAR_2026, name: '2026' },
        subfolder: { id: SPRING, name: 'Spring' },
      });
      expect(docNamed(result, 'Spring archive').location).toEqual({
        workspace: { id: PROMOTIONS, name: 'Promotions' },
        folder: { id: ARCHIVE, name: 'Archive' },
      });
    });

    it('says whether the user may open it, as the listing of its location does', async () => {
      seed(mockStore, { openWorkspaces: true });

      const result = await search(frank);

      // Frank reads Promotions through the group setting, without being one
      // of its members: he may not open its emails from their location either.
      expect(
        result.items.docs.map(({ name, hasAccess }) => [name, hasAccess])
      ).toEqual([
        ['Spring archive', false],
        ['Spring promo', false],
        ['Spring sale', true],
        ['Spring teaser', true],
        ['Weekly news', true],
      ]);
    });
  });
});
