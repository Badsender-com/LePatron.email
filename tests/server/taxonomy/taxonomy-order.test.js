'use strict';

// Ordering by drag and drop (epic #1547, ADR-0026): a drop saves the whole new
// order in one request, refused whole when the list is not exactly what can be
// ordered. No more numbers to type.
//
// Dimensions are ordered among the ones sharing a parent: moving one under
// another parent is a separate, explicit action. Values are ordered within
// their dimension, deactivated ones included.
//
// Created without an order, dimensions are listed by name and values by label:
// the starting point every test below moves away from.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const models = require('../../../packages/server/common/models.common.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  adminB,
  techAdminA,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const declare = (payload, user = techAdminA) =>
  dimensionService.createDimension({ user, payload });

const addValue = (type, payload, user = techAdminA) =>
  taxonomyService.createTaxonomyItem({ user, type, payload });

// The company's dimensions under one parent, in their saved order.
async function siblingsInOrder(user, parentName = null) {
  const dimensions = await dimensionService.listDimensions({ user });
  return dimensions
    .filter((d) => !d.standard && (d.parentName || null) === parentName)
    .sort((a, b) => a.order - b.order)
    .map((d) => d.name);
}

async function labelsInOrder(type) {
  const values = await taxonomyService.listTaxonomyItems({
    user: techAdminA,
    type,
  });
  return values.map((value) => value.label);
}

beforeEach(async () => {
  resetTaxonomyModels(models);
  await declare({ name: 'market', label: 'Marché' });
  await declare({ name: 'brand', label: 'Marque' });
  await declare({ name: 'audience', label: 'Cible' });
  await declare({ name: 'language', label: 'Langue', parentName: 'market' });
  await declare({ name: 'region', label: 'Région', parentName: 'market' });
});

describe('bulk order: dimensions', () => {
  const reorder = (payload, user = techAdminA) =>
    dimensionService.reorderDimensions({ user, ...payload });

  it('orders the first-level dimensions as dropped', async () => {
    await reorder({ parentName: null, names: ['audience', 'market', 'brand'] });

    expect(await siblingsInOrder(techAdminA)).toEqual([
      'audience',
      'market',
      'brand',
    ]);
  });

  it('orders the children of one dimension, leaving the others as they were', async () => {
    await reorder({ parentName: 'market', names: ['region', 'language'] });

    expect(await siblingsInOrder(techAdminA, 'market')).toEqual([
      'region',
      'language',
    ]);
    expect(await siblingsInOrder(techAdminA)).toEqual([
      'audience',
      'brand',
      'market',
    ]);
  });

  it.each([
    ['one is missing', ['audience', 'market']],
    [
      'one hangs under another parent',
      ['audience', 'market', 'brand', 'region'],
    ],
    [
      'a standard dimension is listed',
      ['emailType', 'audience', 'market', 'brand'],
    ],
    ['one is listed twice', ['audience', 'market', 'brand', 'market']],
    ['one does not exist', ['audience', 'market', 'brand', 'season']],
  ])('refuses the whole order when %s', async (_case, names) => {
    await expect(reorder({ parentName: null, names })).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });

    expect(await siblingsInOrder(techAdminA)).toEqual([
      'audience',
      'brand',
      'market',
    ]);
  });

  it("never touches another company's dimensions of the same names", async () => {
    await declare({ name: 'brand', label: 'Brand' }, adminB);
    await declare({ name: 'market', label: 'Market' }, adminB);

    await reorder({ parentName: null, names: ['audience', 'market', 'brand'] });

    expect(await siblingsInOrder(adminB)).toEqual(['brand', 'market']);
  });
});

describe('bulk order: values', () => {
  let france;
  let belgium;
  let canada;
  let switzerland;

  const reorder = (type, values) =>
    taxonomyService.reorderValues({
      user: techAdminA,
      type,
      itemIds: values.map(idOf),
    });

  beforeEach(async () => {
    france = await addValue('market', { label: 'France', canonicalType: 'fr' });
    belgium = await addValue('market', {
      label: 'Belgique',
      canonicalType: 'be',
    });
    canada = await addValue('market', { label: 'Canada', canonicalType: 'ca' });
    switzerland = await addValue('market', {
      label: 'Suisse',
      canonicalType: 'ch',
      isActive: false,
    });
  });

  it('orders the values as dropped, a deactivated one included', async () => {
    await reorder('market', [canada, switzerland, france, belgium]);

    expect(await labelsInOrder('market')).toEqual([
      'Canada',
      'Suisse',
      'France',
      'Belgique',
    ]);
  });

  it('refuses the whole order when a value of the dimension is missing', async () => {
    await expect(
      reorder('market', [canada, france, belgium])
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });

    expect(await labelsInOrder('market')).toEqual([
      'Belgique',
      'Canada',
      'France',
      'Suisse',
    ]);
  });

  it('refuses the whole order when a value of another dimension is listed', async () => {
    const atlas = await addValue('brand', { label: 'Atlas' });

    await expect(
      reorder('market', [canada, switzerland, france, belgium, atlas])
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it("refuses the whole order when another company's value is listed", async () => {
    await declare({ name: 'market', label: 'Market' }, adminB);
    const elsewhere = await addValue('market', { label: 'Spain' }, adminB);

    await expect(
      reorder('market', [canada, switzerland, france, belgium, elsewhere])
    ).rejects.toMatchObject({ status: 400 });
  });
});
