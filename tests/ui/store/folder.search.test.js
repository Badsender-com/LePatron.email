import {
  actions,
  FETCH_MAILINGS,
  FETCH_MAILINGS_TAGS,
  SET_MAILINGS,
  SET_PAGINATION,
} from '~/store/folder.js';

// The listing's fetch in the "all my workspaces" search scope, and what the
// review of #1316 fixed in it (epic #1144, ADR 0007). The 404 and loading
// behaviour of the same action is in folder.test.js.

function context(rootFolder = { id: 'folder-1' }) {
  return {
    commit: jest.fn(),
    dispatch: jest.fn(),
    rootState: { folder: { folder: rootFolder, pagination: {}, filters: {} } },
  };
}

function committed(ctx, type) {
  return ctx.commit.mock.calls
    .filter(([name]) => name === type)
    .map(([, value]) => value);
}

// Searching every accessible workspace (epic #1144, ADR 0007): in the "all"
// search scope, the listing asks the search route, with the filters and the
// pagination of the listing and no location, whatever location the route
// still names. The page size is kept between scopes, so "All" (-1), which the
// search refuses, is sent as its largest page.
describe('folder store, FETCH_MAILINGS in the "all" search scope', () => {
  const found = {
    items: {
      docs: [{ id: 'mailing-1', name: 'Spring sale' }],
      totalDocs: 1,
      limit: 25,
      page: 1,
      totalPages: 1,
    },
  };

  async function fetch(query, { itemsPerPage = 25 } = {}) {
    const ctx = context(null);
    ctx.rootState.folder.pagination = {
      page: 1,
      itemsPerPage,
      sortBy: ['updatedAt'],
      sortDesc: [true],
    };
    ctx.rootState.folder.filters = { name: 'spring', tags: ['promo'] };
    const $axios = { $get: jest.fn().mockResolvedValue(found) };

    await actions[FETCH_MAILINGS].call({ $axios }, ctx, {
      query,
      $t: jest.fn(),
    });

    return { ctx, $axios };
  }

  const searched = (itemsPerPage) => [
    '/mailings/search',
    {
      params: {
        pagination: JSON.stringify({
          page: 1,
          itemsPerPage,
          sortBy: ['updatedAt'],
          sortDesc: [true],
        }),
        filters: JSON.stringify({ name: 'spring', tags: ['promo'] }),
      },
    },
  ];

  it.each([
    ['with no location', { scope: 'all' }],
    ['from a workspace', { scope: 'all', wid: 'workspace-1' }],
    ['from a folder', { scope: 'all', fid: 'folder-1' }],
  ])('asks the search route alone %s, naming no location', async (_, query) => {
    const { $axios } = await fetch(query);

    expect($axios.$get).toHaveBeenCalledTimes(1);
    expect($axios.$get).toHaveBeenCalledWith(...searched(25));
  });

  it.each([
    [50, 50],
    [100, 100],
    [-1, 100],
    [250, 100],
  ])('asks a page size of %p as %p', async (kept, sent) => {
    const { $axios } = await fetch({ scope: 'all' }, { itemsPerPage: kept });

    expect($axios.$get).toHaveBeenCalledWith(...searched(sent));
  });

  it("asks for the group's tags, naming no location", async () => {
    const { ctx } = await fetch({ scope: 'all', wid: 'workspace-1' });

    expect(ctx.dispatch).toHaveBeenCalledWith(FETCH_MAILINGS_TAGS, {
      queryMailing: {},
    });
  });

  it('shows the emails the search found', async () => {
    const { ctx } = await fetch({ scope: 'all' });

    expect(committed(ctx, SET_MAILINGS)).toEqual([
      [{ id: 'mailing-1', name: 'Spring sale' }],
    ]);
  });

  it('keeps listing the current location outside the "all" scope', async () => {
    const { $axios } = await fetch({ wid: 'workspace-1' });

    expect($axios.$get).toHaveBeenCalledTimes(1);
    expect($axios.$get).toHaveBeenCalledWith(
      '/mailings',
      expect.objectContaining({
        params: expect.objectContaining({ workspaceId: 'workspace-1' }),
      })
    );
  });
});

// Review of #1316 (epic #1144).
describe('folder store, FETCH_MAILINGS, what it asks and keeps', () => {
  const page = (totalDocs, limit) => ({
    items: { docs: [], totalDocs, limit, page: 1, totalPages: 1 },
  });

  function ctxWith(rootFolder) {
    const ctx = context(rootFolder);
    ctx.rootState.folder.pagination = { page: 1, itemsPerPage: 25 };
    return ctx;
  }

  it('asks for the location the route names, not the folder of the previous one', async () => {
    const ctx = ctxWith({ id: 'folder-1' });
    const $axios = { $get: jest.fn().mockResolvedValue(page(0, 25)) };

    await actions[FETCH_MAILINGS].call({ $axios }, ctx, {
      query: { wid: 'workspace-1' },
    });

    expect($axios.$get.mock.calls[0][1].params).toMatchObject({
      workspaceId: 'workspace-1',
    });
    expect($axios.$get.mock.calls[0][1].params).not.toHaveProperty(
      'parentFolderId'
    );
  });

  it('keeps the page size of a search page that holds every result', async () => {
    const ctx = ctxWith(null);
    const $axios = { $get: jest.fn().mockResolvedValue(page(25, 25)) };

    await actions[FETCH_MAILINGS].call({ $axios }, ctx, {
      query: { scope: 'all' },
    });

    expect(committed(ctx, SET_PAGINATION)[0].itemsPerPage).toBe(25);
  });

  it('still reads a folder page that holds every email as "All"', async () => {
    const ctx = ctxWith(null);
    const $axios = { $get: jest.fn().mockResolvedValue(page(25, 25)) };

    await actions[FETCH_MAILINGS].call({ $axios }, ctx, {
      query: { wid: 'workspace-1' },
    });

    expect(committed(ctx, SET_PAGINATION)[0].itemsPerPage).toBe(-1);
  });

  it("sends one request for a location's load asked twice at once", async () => {
    const ctx = ctxWith(null);
    const $axios = { $get: jest.fn().mockResolvedValue(page(0, 25)) };
    const store = { $axios };
    const ask = () =>
      actions[FETCH_MAILINGS].call(store, ctx, {
        query: { scope: 'all' },
        dedupe: true,
      });

    await Promise.all([ask(), ask()]);
    await ask();

    expect($axios.$get).toHaveBeenCalledTimes(2);
  });

  // A refresh after a change must not get the answer of a request sent
  // before it.
  it('sends every other fetch, even when the same one is on its way', async () => {
    const ctx = ctxWith(null);
    const $axios = { $get: jest.fn().mockResolvedValue(page(0, 25)) };
    const store = { $axios };
    const ask = (dedupe) =>
      actions[FETCH_MAILINGS].call(store, ctx, {
        query: { scope: 'all' },
        dedupe,
      });

    await Promise.all([ask(true), ask(false)]);

    expect($axios.$get).toHaveBeenCalledTimes(2);
  });
});
