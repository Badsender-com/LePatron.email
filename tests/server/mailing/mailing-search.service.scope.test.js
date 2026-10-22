'use strict';

// Searching every accessible workspace (epic #1144, ADR 0007): the search
// looks through every email of the user's accessible workspaces, in any folder
// or subfolder, within their group (the selected group for a super admin). The
// database applies the rights on the explicit list of accessible locations:
// nothing from another workspace comes back, not even in the count. Each row
// says where the email is and whether the user may open it from there.
//
// The models are in-memory fakes that answer a query as Mongoose and MongoDB
// would (tests/helpers/fake-listing-models.js); the data set is in
// mailing-search.fixtures.js.

const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const { createListingStore } = require('../../helpers/fake-listing-models.js');
const {
  CLIENT_GROUP,
  OTHER_GROUP,
  NEWSLETTERS,
  PROMOTIONS,
  YEAR_2026,
  SPRING,
  ARCHIVE,
  OLD,
  IN_NEWSLETTERS,
  IN_PROMOTIONS,
  IN_CLIENT_GROUP,
  seed,
  frank,
  wendy,
  rita,
  companyAdmin,
  techAdmin,
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
const rows = (result) =>
  result.items.docs.map(({ name, hasAccess }) => [name, hasAccess]);
const openable = (list, hasAccess) => list.map((name) => [name, hasAccess]);

describe('searching every accessible workspace, its scope', () => {
  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist
    // until #1314 ships it, and a top-level require would break the suite.
    ({
      searchMailings,
    } = require('../../../packages/server/mailing/mailing-search.service'));
  });

  beforeEach(() => seed(mockStore));

  describe('which emails come back, for every role', () => {
    // The group keeps each workspace to its members. Every role may search;
    // what comes back depends on the workspaces, not on the role, but for the
    // admins, who read the whole group.
    it.each([
      [
        'a super admin, in the selected group',
        superAdmin(CLIENT_GROUP),
        IN_CLIENT_GROUP,
      ],
      ['a tech admin', techAdmin, IN_CLIENT_GROUP],
      ['a company admin', companyAdmin, IN_CLIENT_GROUP],
      ['a regular user, member of Newsletters', frank, IN_NEWSLETTERS],
      ['a writer, member of Newsletters', wendy, IN_NEWSLETTERS],
      ['a reviewer, member of Promotions', rita, IN_PROMOTIONS],
    ])(
      '%s finds the emails of its accessible workspaces, in any folder or subfolder, and may open them',
      async (_, user, expected) => {
        const result = await search(user);

        expect(rows(result)).toEqual(openable(expected, true));
        expect(result.items.totalDocs).toBe(expected.length);
      }
    );

    it('never returns an email of a workspace the user cannot access, nor of its folders, nor counts it', async () => {
      const result = await search(frank, { filters: { name: 'spring' } });

      expect(names(result)).toEqual(['Spring sale', 'Spring teaser']);
      expect(result.items.totalDocs).toBe(2);
    });

    it('covers every workspace of the group for every member when the group opens all workspaces to its users', async () => {
      seed(mockStore, { openWorkspaces: true });

      expect(names(await search(frank))).toEqual(IN_CLIENT_GROUP);
      expect(names(await search(rita))).toEqual(IN_CLIENT_GROUP);
    });

    it('never returns an email whose location is gone', async () => {
      const result = await search(companyAdmin, {
        filters: { name: 'orphan' },
      });

      expect(names(result)).toEqual([]);
      expect(result.items.totalDocs).toBe(0);
    });

    it('limits a super admin to the selected group', async () => {
      const inOtherGroup = await search(superAdmin(OTHER_GROUP));

      expect(names(inOtherGroup)).toEqual([
        'Spring deep elsewhere',
        'Spring elsewhere',
      ]);
    });

    it('refuses the bootstrap account, which stays in the settings', async () => {
      await expect(search(bootstrapAccount)).rejects.toMatchObject({
        status: 403,
        message: ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION,
      });
    });
  });

  describe('what each email says', () => {
    it('gives its location: workspace, folder, subfolder', async () => {
      const result = await search(companyAdmin);
      const newsletters = { id: NEWSLETTERS, name: 'Newsletters' };
      const promotions = { id: PROMOTIONS, name: 'Promotions' };

      expect(docNamed(result, 'Weekly news').location).toEqual({
        workspace: newsletters,
      });
      expect(docNamed(result, 'Spring sale').location).toEqual({
        workspace: newsletters,
        folder: { id: YEAR_2026, name: '2026' },
      });
      // Its subfolder still carries the workspace: the parent folder decides.
      expect(docNamed(result, 'Spring teaser').location).toEqual({
        workspace: newsletters,
        folder: { id: YEAR_2026, name: '2026' },
        subfolder: { id: SPRING, name: 'Spring' },
      });
      expect(docNamed(result, 'Spring promo').location).toEqual({
        workspace: promotions,
      });
      expect(docNamed(result, 'Spring archive').location).toEqual({
        workspace: promotions,
        folder: { id: ARCHIVE, name: 'Archive' },
      });
      expect(docNamed(result, 'Spring old').location).toEqual({
        workspace: promotions,
        folder: { id: ARCHIVE, name: 'Archive' },
        subfolder: { id: OLD, name: 'Old' },
      });
    });

    it('says whether the user may open it, as the listing of its location does', async () => {
      seed(mockStore, { openWorkspaces: true });

      // Frank and Rita read each other's workspace through the group setting,
      // without being one of its members: they may not open its emails from
      // their location either.
      expect(rows(await search(frank))).toEqual([
        ...openable(IN_PROMOTIONS, false),
        ...openable(IN_NEWSLETTERS, true),
      ]);
      expect(rows(await search(rita))).toEqual([
        ...openable(IN_PROMOTIONS, true),
        ...openable(IN_NEWSLETTERS, false),
      ]);
    });
  });
});
