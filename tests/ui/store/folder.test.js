import {
  actions,
  FETCH_FOLDER_OR_WORKSPACE,
  FETCH_MAILINGS,
  FETCH_MAILINGS_FOR_FILTER_UPDATE,
  FETCH_MAILINGS_FOR_WORKSPACE_UPDATE,
  IS_LOADING_WORKSPACE_OR_FOLDER,
  SET_IS_LOADING_MAILINGS_FOR_FILTER_UPDATE,
  SET_IS_LOADING_MAILINGS_FOR_WORKSPACE_UPDATE,
  SET_LOCATION_NOT_FOUND,
  SET_MAILINGS,
} from '~/store/folder.js';

// The mailing list stayed on its loading skeleton forever when the workspace or
// folder of the route answered 404 (hidden since the company turned off "access
// to all workspaces"). Two faults: the error branch called a detached vue-i18n
// `$t`, which throws, and the loading flag was lowered after the await only, so
// that throw left it up. A 404 now flags the location for the workspace tree to
// leave, and the flags come down whatever happens.

const SNACKBAR = 'page/SHOW_SNACKBAR';

function notFound() {
  return Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404, data: { message: 'WORKSPACE_NOT_FOUND' } },
  });
}

function serverError() {
  return Object.assign(new Error('Request failed with status code 500'), {
    response: { status: 500 },
  });
}

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

describe('folder store, FETCH_MAILINGS', () => {
  const query = { fid: 'folder-1' };

  it('flags the location as not found on a 404, without an error snackbar', async () => {
    const ctx = context();
    const $axios = { $get: jest.fn().mockRejectedValue(notFound()) };
    const $t = jest.fn((key) => key);

    await actions[FETCH_MAILINGS].call({ $axios }, ctx, { query, $t });

    expect(committed(ctx, SET_LOCATION_NOT_FOUND)).toEqual([true]);
    expect(committed(ctx, SET_MAILINGS)).toEqual([[]]);
    expect(committed(ctx, SNACKBAR)).toEqual([]);
  });

  it('still reports any other failure', async () => {
    const ctx = context();
    const $axios = { $get: jest.fn().mockRejectedValue(serverError()) };
    const $t = jest.fn((key) => key);

    await actions[FETCH_MAILINGS].call({ $axios }, ctx, { query, $t });

    expect(committed(ctx, SNACKBAR)).toEqual([
      { text: 'global.errors.errorOccured', color: 'error' },
    ]);
    expect(committed(ctx, SET_LOCATION_NOT_FOUND)).toEqual([]);
  });
});

describe('folder store, loading flags', () => {
  // What a detached vue-i18n `$t` did: it reads `this.$i18n` on undefined.
  const throwing = () => Promise.reject(new TypeError("reading '$i18n'"));

  it.each([
    [
      FETCH_MAILINGS_FOR_WORKSPACE_UPDATE,
      SET_IS_LOADING_MAILINGS_FOR_WORKSPACE_UPDATE,
    ],
    [
      FETCH_MAILINGS_FOR_FILTER_UPDATE,
      SET_IS_LOADING_MAILINGS_FOR_FILTER_UPDATE,
    ],
  ])('%s lowers its flag even when the fetch throws', async (action, flag) => {
    const ctx = context();
    ctx.dispatch.mockImplementation(throwing);

    await expect(
      actions[action].call({}, ctx, { query: { fid: 'folder-1' } })
    ).rejects.toThrow(TypeError);

    expect(committed(ctx, flag)).toEqual([true, false]);
  });
});

describe('folder store, FETCH_FOLDER_OR_WORKSPACE', () => {
  it('flags a workspace that answers 404, without an error snackbar', async () => {
    const ctx = context(null);
    const $axios = { $get: jest.fn().mockRejectedValue(notFound()) };
    const $t = jest.fn((key) => key);

    await actions[FETCH_FOLDER_OR_WORKSPACE].call({ $axios }, ctx, {
      query: { wid: 'workspace-1' },
      $t,
    });

    expect(committed(ctx, SET_LOCATION_NOT_FOUND)).toEqual([false, true]);
    expect(committed(ctx, SNACKBAR)).toEqual([]);
    expect(committed(ctx, IS_LOADING_WORKSPACE_OR_FOLDER)).toEqual([
      true,
      false,
    ]);
  });

  // Reset on every location, so leaving a missing one for another missing one
  // still changes the flag the workspace tree watches.
  it('clears the flag before loading the next location', async () => {
    const ctx = context(null);
    const $axios = { $get: jest.fn().mockResolvedValue({}) };

    await actions[FETCH_FOLDER_OR_WORKSPACE].call({ $axios }, ctx, {
      query: { wid: 'workspace-1' },
    });

    expect(committed(ctx, SET_LOCATION_NOT_FOUND)).toEqual([false]);
  });
});

// The root cause, guarded where it is written: `$t: this.$t` hands the store a
// vue-i18n method detached from its component, which throws when called.
describe('callers of the store', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '../../../packages/ui');

  function sources(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return ['node_modules', '.nuxt', 'static'].includes(entry.name)
          ? []
          : sources(full);
      }
      return /\.(vue|js)$/.test(entry.name) ? [full] : [];
    });
  }

  it('never pass a detached $t', () => {
    const offenders = sources(root).filter((file) =>
      /\$t:\s*this\.\$t\b(?!\()/.test(fs.readFileSync(file, 'utf8'))
    );
    expect(offenders.map((file) => path.relative(root, file))).toEqual([]);
  });
});
