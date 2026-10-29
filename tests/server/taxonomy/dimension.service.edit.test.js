'use strict';

// Acceptance tests of the dimensions (epic #1351, ADR-0014 and ADR-0015).
//
// A dimension is an axis a company declines its emails by. Two are standard, the
// email type and the email trigger; every other one is declared by the company.
// The collections are in-memory fakes that interpret queries like MongoDB, so
// these tests hold the service to its answers, not to the shape of its queries.
//
// A malformed request is a 400, as everywhere else in the taxonomy module; a
// request that is well formed but contradicts what is stored is a 409.

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

beforeEach(() => resetTaxonomyModels(models));

const byName = (dimensions, name) =>
  dimensions.find((dimension) => dimension.name === name);

// Turned on by #1354 (declare a company dimension and its values)
describe.skip('editing, deactivating and deleting a dimension', () => {
  let dimensionService;
  let audience;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1353.
    dimensionService = require(DIMENSION_SERVICE);
  });

  beforeEach(async () => {
    audience = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'audience', label: 'Cible' },
    });
  });

  const reload = async () =>
    byName(await dimensionService.listDimensions({ user: adminA }), 'audience');

  it('edits its label, description and order', async () => {
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(audience),
      payload: {
        label: 'Segment',
        description: 'Le segment CRM visé.',
        order: 30,
      },
    });

    expect(await reload()).toMatchObject({
      label: 'Segment',
      description: 'Le segment CRM visé.',
      order: 30,
    });
  });

  it('refuses to rename it: templates read that name', async () => {
    await expect(
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(audience),
        payload: { name: 'segment' },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.DIMENSION_NAME_IS_FINAL,
    });
    expect((await reload()).name).toBe('audience');
  });

  it('deactivates it, keeps listing it, and reactivates it', async () => {
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(audience),
      payload: { isActive: false },
    });
    expect(await reload()).toMatchObject({ isActive: false });

    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(audience),
      payload: { isActive: true },
    });
    expect(await reload()).toMatchObject({ isActive: true });
  });

  it('deletes it while it has no values, which frees its name', async () => {
    await dimensionService.deleteDimension({
      user: adminA,
      dimensionId: idOf(audience),
    });

    expect(await reload()).toBeUndefined();
    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: { name: 'audience', label: 'Cible' },
      })
    ).resolves.toMatchObject({ name: 'audience' });
  });

  it('refuses to delete it once it has values, giving their count', async () => {
    models.TaxonomyItems.seed([
      { _company: COMPANY_A, type: 'audience', label: 'Clients VIP' },
      { _company: COMPANY_A, type: 'audience', label: 'Prospects' },
    ]);

    await expect(
      dimensionService.deleteDimension({
        user: adminA,
        dimensionId: idOf(audience),
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_HAS_VALUES,
      details: { valueCount: 2 },
    });
  });

  it("refuses to delete another company's dimension, as if it did not exist", async () => {
    await expect(
      dimensionService.deleteDimension({
        user: adminB,
        dimensionId: idOf(audience),
      })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.DIMENSION_NOT_FOUND,
    });
  });
});
