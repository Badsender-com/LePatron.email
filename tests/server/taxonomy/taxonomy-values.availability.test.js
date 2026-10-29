'use strict';

// Acceptance tests of the values of a dimension (epic #1351, ADR-0014).
//
// A value is one of the possibilities of a dimension: Canada, French, Newsletter.
// Nothing is ever rewritten silently: deleting a value something still depends on
// is refused, and the refusal says how many things depend on it.
//
// The dimensions are set up through their own service, so these tests only rely
// on public interfaces; the collections are in-memory fakes that interpret
// queries like MongoDB.

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
  adminA,
  idOf,
  idsOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const DIMENSION_SERVICE =
  '../../../packages/server/taxonomy/services/dimension.service.js';
const TAXONOMY_SERVICE =
  '../../../packages/server/taxonomy/services/taxonomy.service.js';

let dimensionService;
let taxonomyService;

// Required lazily: both modules move or appear with #1353, and a top-level
// require would break the suite until then.
function loadServices() {
  dimensionService = require(DIMENSION_SERVICE);
  taxonomyService = require(TAXONOMY_SERVICE);
}

beforeEach(() => resetTaxonomyModels(models));

const declare = (payload, user = adminA) =>
  dimensionService.createDimension({ user, payload });

const addValue = (type, payload, user = adminA) =>
  taxonomyService.createTaxonomyItem({ user, type, payload });

// Turned on by #1358 (nested dimensions and availability)
describe.skip('availability', () => {
  let canada;
  let belgium;

  beforeAll(loadServices);

  beforeEach(async () => {
    await declare({ name: 'market', label: 'Marché' });
    await declare({ name: 'language', label: 'Langue', parentName: 'market' });
    await declare({ name: 'brand', label: 'Marque' });
    canada = await addValue('market', { label: 'Canada', canonicalType: 'ca' });
    belgium = await addValue('market', {
      label: 'Belgique',
      canonicalType: 'be',
    });
  });

  it('offers a value under the parent values it is given', async () => {
    const french = await addValue('language', {
      label: 'Français',
      canonicalType: 'fr',
      parentIds: [idOf(canada), idOf(belgium)],
    });

    expect(idsOf(french._parents).sort()).toEqual(
      [idOf(canada), idOf(belgium)].sort()
    );
  });

  it('narrows the availability of a value', async () => {
    const french = await addValue('language', {
      label: 'Français',
      parentIds: [idOf(canada), idOf(belgium)],
    });

    const narrowed = await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(french),
      payload: { parentIds: [idOf(belgium)] },
    });

    expect(idsOf(narrowed._parents)).toEqual([idOf(belgium)]);
  });

  it('refuses a parent value of another dimension', async () => {
    const brand = await addValue('brand', { label: 'Marque A' });

    await expect(
      addValue('language', { label: 'Français', parentIds: [idOf(brand)] })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('refuses an availability on a value whose dimension has no parent', async () => {
    await expect(
      addValue('brand', { label: 'Marque A', parentIds: [idOf(canada)] })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('refuses to delete a value another value is offered under, giving their count', async () => {
    await addValue('language', {
      label: 'Français',
      parentIds: [idOf(canada), idOf(belgium)],
    });
    await addValue('language', {
      label: 'Anglais',
      parentIds: [idOf(canada)],
    });

    // Removing Canada from their lists would leave English with none, and an
    // empty availability means "offered everywhere".
    await expect(
      taxonomyService.deleteTaxonomyItem({ user: adminA, itemId: idOf(canada) })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_IS_PARENT,
      details: { childCount: 2 },
    });
  });
});
