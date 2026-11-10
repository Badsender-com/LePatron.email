/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Searching every accessible workspace, narrowed (ADR 0007): by location, by
// author, by name or by words, never beyond what the user may read; and the
// search by words of the MCP `search` tool, which reads a page of names and
// counts nothing.
//
// The data set is mailing-search.fixtures.js, over the MCP fakes
// (tests/helpers/mcp-fake-models.js) rather than the listing's: they read the
// email types, apply a query's projection, and count a page as
// mongoose-paginate-v2 does.

const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const { createMcpStore } = require('../../helpers/mcp-fake-models.js');
const {
  CLIENT_GROUP,
  OTHER_GROUP,
  NEWSLETTERS,
  PROMOTIONS,
  YEAR_2026,
  SPRING,
  ARCHIVE,
  IN_NEWSLETTERS,
  IN_CLIENT_GROUP,
  MAILINGS,
  mailing,
  inClient,
  seed,
  frank,
  companyAdmin,
  superAdmin,
  BY_NAME,
  names,
} = require('./mailing-search.fixtures.js');

const mockStore = createMcpStore();

jest.mock(
  '../../../packages/server/common/models.common.js',
  () => mockStore.models
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  searchMailings,
  findMailingsByWords,
} = require('../../../packages/server/mailing/mailing-search.service');

const { Mailings, TaxonomyItems } = mockStore.models;

const search = (user, within) =>
  searchMailings({ user, pagination: BY_NAME, within });
const sorted = (list) => [...list].sort();

describe('searching every accessible workspace, narrowed', () => {
  beforeEach(() => seed(mockStore));
  afterEach(() => jest.restoreAllMocks());

  describe('by location', () => {
    it('keeps the workspaces named, with their folders', async () => {
      expect(
        names(await search(companyAdmin, { workspaceIds: [NEWSLETTERS] }))
      ).toEqual(sorted(IN_NEWSLETTERS));
    });

    it('keeps a folder with its subfolders, and a subfolder alone', async () => {
      expect(names(await search(frank, { folderIds: [YEAR_2026] }))).toEqual([
        'Spring sale',
        'Spring teaser',
      ]);
      expect(names(await search(frank, { folderIds: [SPRING] }))).toEqual([
        'Spring teaser',
      ]);
    });

    it('finds nothing in a location the user may not read', async () => {
      expect(
        names(await search(frank, { workspaceIds: [PROMOTIONS] }))
      ).toEqual([]);
      expect(names(await search(frank, { folderIds: [ARCHIVE] }))).toEqual([]);
    });

    it('takes empty lists as no narrowing', async () => {
      expect(
        names(await search(companyAdmin, { workspaceIds: [], folderIds: [] }))
      ).toEqual(sorted(IN_CLIENT_GROUP));
    });
  });

  describe('by author and by name', () => {
    beforeEach(() =>
      seed(mockStore, {
        mailings: [
          ...MAILINGS,
          mailing(
            'Événement de rentrée',
            inClient({ _workspace: NEWSLETTERS }),
            { _user: frank.id, author: 'Hélène Martin' }
          ),
        ],
      })
    );

    it("keeps the user's own emails", async () => {
      expect(names(await search(frank, { userIds: [frank.id] }))).toEqual([
        'Événement de rentrée',
      ]);
    });

    it.each([
      ['the author', { authorName: 'HELENE' }],
      ['the email', { name: 'EVENEMENT de rentree' }],
    ])(
      'matches a part of the name of %s, whatever its case and accents',
      async (_, within) => {
        expect(names(await search(frank, within))).toEqual([
          'Événement de rentrée',
        ]);
      }
    );

    it('takes a name as written, never as a pattern', async () => {
      expect(names(await search(frank, { name: '.*' }))).toEqual([]);
    });
  });

  describe('by words', () => {
    it('keeps the emails holding every word, in any field that describes them', async () => {
      const type = await TaxonomyItems.create({
        _company: CLIENT_GROUP,
        type: 'emailType',
        label: 'Saisonnière',
      });
      mockStore.update('mailings', MAILINGS[2]._id, {
        _emailType: type._id,
        subject: 'Ready for spring',
      });

      expect(names(await search(frank, { words: ['weekly'] }))).toEqual([
        'Weekly news',
      ]);
      expect(
        names(await search(frank, { words: ['saisonniere', 'ready'] }))
      ).toEqual(['Spring teaser']);
    });
  });
});

describe('the mailings a user may read, by words', () => {
  beforeEach(() => seed(mockStore));
  afterEach(() => jest.restoreAllMocks());

  it('gives the readable ones, the most recently updated first', async () => {
    const found = await findMailingsByWords(frank, ['spring'], 20);

    expect(found.map((m) => m.name)).toEqual(['Spring sale', 'Spring teaser']);
  });

  it('reads their id, name and update date, and nothing else', async () => {
    const [found] = await findMailingsByWords(frank, ['weekly'], 20);

    expect(Object.keys(found).sort()).toEqual(['_id', 'name', 'updatedAt']);
  });

  it('gives as many as asked, 25 unless asked, 100 at most', async () => {
    const limits = [];
    const find = Mailings.find;
    jest.spyOn(Mailings, 'find').mockImplementation((...args) => {
      const query = find(...args);
      const limit = query.limit;
      query.limit = (count) => {
        limits.push(count);
        return limit(count);
      };
      return query;
    });

    expect(await findMailingsByWords(companyAdmin, ['spring'], 1)).toHaveLength(
      1
    );
    await findMailingsByWords(companyAdmin, ['spring'], 500);
    await findMailingsByWords(companyAdmin, ['spring']);
    expect(limits).toEqual([1, 100, 25]);
  });

  it('keeps a super admin to the selected group', async () => {
    const found = await findMailingsByWords(
      superAdmin(OTHER_GROUP),
      ['spring'],
      20
    );

    expect(found.map((m) => m.name).sort()).toEqual([
      'Spring deep elsewhere',
      'Spring elsewhere',
    ]);
  });

  it('counts nothing', async () => {
    const counts = jest.spyOn(Mailings, 'countDocuments');

    await findMailingsByWords(frank, ['spring'], 20);

    expect(counts).not.toHaveBeenCalled();
  });

  it('answers a 503 when the search runs out of its time', async () => {
    const outOfTime = Object.assign(new Error('operation exceeded time'), {
      code: 50,
    });
    const query = {
      select: () => query,
      sort: () => query,
      limit: () => query,
      maxTimeMS: () => query,
      lean: () => Promise.reject(outOfTime),
    };
    jest.spyOn(Mailings, 'find').mockReturnValue(query);

    await expect(
      findMailingsByWords(frank, ['spring'], 20)
    ).rejects.toMatchObject({
      status: 503,
      message: ERROR_CODES.SEARCH_TIMEOUT,
    });
  });
});
