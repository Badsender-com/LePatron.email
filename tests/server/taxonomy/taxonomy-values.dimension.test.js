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
  COMPANY_A,
  adminA,
  adminB,
  idOf,
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

// Turned on by #1353 (dimensions are records; the email type and the trigger as
// standard dimensions)
describe.skip('a value belongs to a dimension', () => {
  beforeAll(loadServices);

  it('still creates an email type value', async () => {
    const value = await addValue('emailType', {
      label: 'Infolettre',
      canonicalType: 'editorial',
    });

    expect(value).toMatchObject({ type: 'emailType', label: 'Infolettre' });
  });

  it('refuses a value under a dimension the company has not declared', async () => {
    await expect(
      addValue('audience', { label: 'Clients VIP' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_TYPE,
    });
  });

  it("refuses a value under another company's dimension", async () => {
    await declare({ name: 'audience', label: 'Cible' }, adminB);

    await expect(
      addValue('audience', { label: 'Clients VIP' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_TYPE,
    });
  });

  it('refuses a value under the trigger: its two values are the doctrine’s', async () => {
    await dimensionService.listDimensions({ user: adminA });

    await expect(
      addValue('trigger', { label: 'Scénario' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_TYPE,
    });
  });
});

// Turned on by #1354 (declare a company dimension and its values)
describe.skip('values of a company dimension', () => {
  beforeAll(loadServices);

  beforeEach(async () => {
    await declare({ name: 'audience', label: 'Cible' });
    await declare({ name: 'brand', label: 'Marque' });
  });

  it('gives a company dimension its values, with their identifier', async () => {
    await addValue('audience', {
      label: 'Clients VIP',
      canonicalType: 'vip',
      description: 'Plus de trois commandes dans l’année.',
    });
    await addValue('audience', { label: 'Prospects' });

    const values = await taxonomyService.listTaxonomyItems({
      user: adminA,
      type: 'audience',
    });

    expect(values.map((value) => value.label).sort()).toEqual([
      'Clients VIP',
      'Prospects',
    ]);
    expect(values.find((value) => value.label === 'Clients VIP')).toMatchObject(
      {
        canonicalType: 'vip',
        description: 'Plus de trois commandes dans l’année.',
      }
    );
  });

  it('refuses a value under a deactivated dimension', async () => {
    const dimensions = await dimensionService.listDimensions({ user: adminA });
    const audience = dimensions.find((d) => d.name === 'audience');
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(audience),
      payload: { isActive: false },
    });

    await expect(
      addValue('audience', { label: 'Clients VIP' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_TYPE,
    });
  });

  it('refuses two values of one dimension sharing an identifier', async () => {
    await addValue('audience', { label: 'Clients VIP', canonicalType: 'vip' });

    await expect(
      addValue('audience', { label: 'Très bons clients', canonicalType: 'vip' })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_IDENTIFIER_ALREADY_EXISTS,
    });
  });

  it('refuses the clash on an edit too', async () => {
    await addValue('audience', { label: 'Clients VIP', canonicalType: 'vip' });
    const other = await addValue('audience', {
      label: 'Prospects',
      canonicalType: 'prospects',
    });

    await expect(
      taxonomyService.updateTaxonomyItem({
        user: adminA,
        itemId: idOf(other),
        payload: { canonicalType: 'vip' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_IDENTIFIER_ALREADY_EXISTS,
    });
  });

  it('accepts one identifier in two dimensions', async () => {
    await addValue('audience', { label: 'Clients VIP', canonicalType: 'vip' });

    await expect(
      addValue('brand', { label: 'Gamme VIP', canonicalType: 'vip' })
    ).resolves.toMatchObject({ canonicalType: 'vip' });
  });

  it('accepts values with no identifier at all', async () => {
    await addValue('audience', { label: 'Clients VIP' });

    await expect(
      addValue('audience', { label: 'Prospects' })
    ).resolves.toMatchObject({ label: 'Prospects' });
  });

  it('refuses the 201st value of a dimension, naming the limit', async () => {
    models.TaxonomyItems.seed(
      Array.from({ length: 200 }, (_, i) => ({
        _company: COMPANY_A,
        type: 'audience',
        label: `Segment ${i + 1}`,
      }))
    );

    await expect(
      addValue('audience', { label: 'Segment 201' })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_LIMIT_REACHED,
      details: { limit: 200 },
    });
  });

  it('still accepts values in another dimension when one is full', async () => {
    models.TaxonomyItems.seed(
      Array.from({ length: 200 }, (_, i) => ({
        _company: COMPANY_A,
        type: 'audience',
        label: `Segment ${i + 1}`,
      }))
    );

    await expect(
      addValue('brand', { label: 'Marque A' })
    ).resolves.toMatchObject({ type: 'brand' });
  });

  it('deletes a value no email uses', async () => {
    const vip = await addValue('audience', { label: 'Clients VIP' });

    await taxonomyService.deleteTaxonomyItem({
      user: adminA,
      itemId: idOf(vip),
    });

    expect(
      await taxonomyService.listTaxonomyItems({
        user: adminA,
        type: 'audience',
      })
    ).toHaveLength(0);
  });

  it('refuses to delete a value emails use, giving their count', async () => {
    const vip = await addValue('audience', { label: 'Clients VIP' });
    models.Mailings.seed([
      { _company: COMPANY_A, _taxonomyItems: [vip._id] },
      { _company: COMPANY_A, _taxonomyItems: [vip._id] },
    ]);

    await expect(
      taxonomyService.deleteTaxonomyItem({ user: adminA, itemId: idOf(vip) })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_IN_USE,
      details: { usageCount: 2 },
    });
  });
});
