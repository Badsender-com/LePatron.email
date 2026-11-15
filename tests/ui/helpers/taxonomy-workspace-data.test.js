'use strict';

// What the taxonomy workspace reads (review of #1547): a late answer is
// dropped, and the points to check wait for every read, never computed from
// a read that failed.

const mixin = require('~/helpers/mixins/mixin-taxonomy-workspace-data.js')
  .default;

// A deferred answer per request, answered by the test in the order it wants.
function workspace() {
  const pending = [];
  const ctx = {
    ...mixin.data(),
    groupId: 'company-a',
    $i18n: { locale: 'fr' },
    $t: (key) => key,
    $emit: jest.fn(),
    showSnackbar: jest.fn(),
    $axios: {
      $get: jest.fn(
        (url) =>
          new Promise((resolve, reject) =>
            pending.push({ url, resolve, reject })
          )
      ),
    },
  };
  Object.entries(mixin.methods).forEach(([name, method]) => {
    ctx[name] = method.bind(ctx);
  });
  Object.entries(mixin.computed).forEach(([name, getter]) => {
    Object.defineProperty(ctx, name, { get: () => getter.call(ctx) });
  });
  const answer = (index, items) => pending[index].resolve({ items });
  const fail = (index) => pending[index].reject(new Error('down'));
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { ctx, pending, answer, fail, flush };
}

const MARKET = { name: 'market', label: 'Marché' };

describe('the workspace reads', () => {
  it('keeps the latest answer for a dimension read twice', async () => {
    const { ctx, answer, flush } = workspace();
    ctx.dimensions = [MARKET];

    const first = ctx.fetchValues(['market']);
    const second = ctx.fetchValues(['market']);
    answer(1, [
      { id: 'fr', type: 'market' },
      { id: 'be', type: 'market' },
    ]);
    await second;
    answer(0, [{ id: 'fr', type: 'market' }]);
    await first;
    await flush();

    expect(ctx.valuesByType.market.map((value) => value.id)).toEqual([
      'fr',
      'be',
    ]);
  });

  it('drops the answer of a company the super admin has left', async () => {
    const { ctx, pending, answer, flush } = workspace();
    ctx.dimensions = [MARKET];

    const late = ctx.fetchValues(['market']);
    ctx.groupId = 'company-b';
    ctx.generation += 1;
    answer(0, [{ id: 'fr', type: 'market' }]);
    await late;
    await flush();

    expect(pending).toHaveLength(1);
    expect(ctx.valuesByType.market).toBeUndefined();
  });

  it('computes no point before every read is in', async () => {
    const { ctx, answer, flush } = workspace();

    ctx.loadAll();
    // The dimensions, then the templates.
    answer(0, [MARKET]);
    await flush();

    expect(ctx.isLoaded).toBe(false);
    expect(ctx.points).toEqual([]);

    answer(1, []);
    answer(2, []);
    await flush();

    expect(ctx.isLoaded).toBe(true);
    // A dimension with no value is a point, now that the answer says so.
    expect(ctx.points.map((point) => point.kind)).toContain('noValue');
  });

  it('computes no point from a read that failed, and says it failed', async () => {
    const { ctx, answer, fail, flush } = workspace();

    ctx.loadAll();
    answer(0, [MARKET]);
    await flush();
    answer(1, []);
    fail(2);
    await flush();

    expect(ctx.loadFailed).toBe(true);
    expect(ctx.points).toEqual([]);
    expect(ctx.showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'error' })
    );
  });
});
