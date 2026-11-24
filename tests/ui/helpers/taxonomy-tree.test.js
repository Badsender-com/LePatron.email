'use strict';

// The tree of dimensions on the left of the taxonomy workspace, the segments of
// the selected dimension, and what the URL selects (epic #1547). Pure helpers:
// the components stay thin, the way the rest of packages/ui is tested.

const { DIMENSIONS, VALUES } = require('./taxonomy-workspace.fixtures.js');

const TREE = '~/helpers/taxonomy-tree.js';
const REORDER = '~/helpers/reorder.js';

describe('dimension tree', () => {
  let dimensionTree;
  let segmentsOf;
  let workspaceSelection;

  beforeAll(() => {
    ({ dimensionTree, segmentsOf, workspaceSelection } = require(TREE));
  });

  const names = (rows) =>
    rows.map((row) => (row.kind === 'section' ? `[${row.key}]` : row.name));

  it('lists the standard dimensions first, then the company ones nested under their parent', () => {
    const rows = dimensionTree({ dimensions: DIMENSIONS, values: VALUES });

    expect(names(rows)).toEqual([
      '[standard]',
      'emailType',
      'trigger',
      '[company]',
      'market',
      'language',
      'brand',
      'range',
      'audience',
    ]);
  });

  it('gives each dimension its depth, its lock and its count of values', () => {
    const rows = dimensionTree({ dimensions: DIMENSIONS, values: VALUES });
    const row = (name) => rows.find((r) => r.name === name);

    expect(row('emailType')).toMatchObject({
      depth: 0,
      locked: true,
      count: 1,
    });
    // The trigger's two values are the doctrine's, never taxonomy items.
    expect(row('trigger')).toMatchObject({ depth: 0, locked: true, count: 2 });
    expect(row('market')).toMatchObject({ depth: 0, locked: false, count: 5 });
    expect(row('language')).toMatchObject({ depth: 1, count: 5 });
    expect(row('range')).toMatchObject({ depth: 1, count: 1 });
    expect(row('audience')).toMatchObject({ depth: 0, count: 0 });
  });

  it('orders siblings by their order, whatever the order of other levels', () => {
    const rows = dimensionTree({
      dimensions: [
        ...DIMENSIONS,
        {
          ...DIMENSIONS.find((d) => d.name === 'language'),
          id: 'dim-region',
          name: 'region',
          label: 'Région',
          role: null,
          order: 5,
        },
      ],
      values: VALUES,
    });

    expect(names(rows).slice(4, 7)).toEqual(['market', 'region', 'language']);
  });

  it('nests a grandchild one level further', () => {
    const rows = dimensionTree({
      dimensions: [
        ...DIMENSIONS,
        {
          ...DIMENSIONS.find((d) => d.name === 'audience'),
          id: 'dim-dialect',
          name: 'dialect',
          label: 'Dialecte',
          parentName: 'language',
        },
      ],
      values: VALUES,
    });

    expect(rows.find((r) => r.name === 'dialect')).toMatchObject({ depth: 2 });
    expect(names(rows).indexOf('dialect')).toBe(
      names(rows).indexOf('language') + 1
    );
  });

  it('keeps a deactivated dimension in the tree, marked', () => {
    const rows = dimensionTree({
      dimensions: DIMENSIONS.map((d) =>
        d.name === 'audience' ? { ...d, isActive: false } : d
      ),
      values: VALUES,
    });

    expect(rows.find((r) => r.name === 'audience')).toMatchObject({
      inactive: true,
    });
  });

  it.each([
    ['trigger', ['values']],
    ['emailType', ['values', 'tokens', 'templates', 'settings']],
    ['market', ['values', 'tokens', 'templates', 'settings']],
    ['language', ['values', 'crossings', 'tokens', 'templates', 'settings']],
  ])('gives %s the segments %j', (name, expected) => {
    expect(segmentsOf(DIMENSIONS.find((d) => d.name === name))).toEqual(
      expected
    );
  });

  it.each([
    [{}, { dimension: 'emailType', tab: 'values' }],
    [
      { dimension: 'language', tab: 'crossings' },
      { dimension: 'language', tab: 'crossings' },
    ],
    [
      { dimension: 'season', tab: 'values' },
      { dimension: 'emailType', tab: 'values' },
    ],
    // A first-level dimension has no crossings: its values instead.
    [
      { dimension: 'market', tab: 'crossings' },
      { dimension: 'market', tab: 'values' },
    ],
    [{ dimension: 'brand' }, { dimension: 'brand', tab: 'values' }],
  ])('reads the query %j as %j', (query, expected) => {
    expect(workspaceSelection({ dimensions: DIMENSIONS, query })).toEqual(
      expected
    );
  });
});

describe('reordering after a drop', () => {
  let moveItem;

  beforeAll(() => {
    ({ moveItem } = require(REORDER));
  });

  const LIST = ['France', 'Belgique', 'Suisse', 'Canada'];

  it('moves an item down', () => {
    expect(moveItem(LIST, 0, 2)).toEqual([
      'Belgique',
      'Suisse',
      'France',
      'Canada',
    ]);
  });

  it('moves an item up', () => {
    expect(moveItem(LIST, 3, 1)).toEqual([
      'France',
      'Canada',
      'Belgique',
      'Suisse',
    ]);
  });

  it('returns the same order for a drop where it started', () => {
    expect(moveItem(LIST, 2, 2)).toEqual(LIST);
  });

  it('never changes the list it was given', () => {
    moveItem(LIST, 0, 3);

    expect(LIST).toEqual(['France', 'Belgique', 'Suisse', 'Canada']);
  });

  it('keeps a drop past either end within the list', () => {
    expect(moveItem(LIST, 1, 9)).toEqual([
      'France',
      'Suisse',
      'Canada',
      'Belgique',
    ]);
    expect(moveItem(LIST, 2, -1)).toEqual([
      'Suisse',
      'France',
      'Belgique',
      'Canada',
    ]);
  });
});
