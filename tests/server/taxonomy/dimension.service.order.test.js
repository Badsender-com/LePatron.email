'use strict';

// Acceptance tests of the dimensions (epic #1351, ADR-0032 and ADR-0015).
//
// A dimension is an axis a company declines its emails by. Two are standard, the
// email type and the email trigger; every other one is declared by the company.
// The collections are in-memory fakes that interpret queries like MongoDB, so
// these tests hold the service to its answers, not to the shape of its queries.
//
// The one order the server's listing, the screen and the editor share
// (packages/shared/taxonomy/sort.js), and the order a new dimension takes.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const models = require('../../../packages/server/common/models.common.js');
const {
  COMPANY_A,
  adminA,
  adminB,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const DIMENSION_SERVICE =
  '../../../packages/server/taxonomy/services/dimension.service.js';

beforeEach(() => resetTaxonomyModels(models));

describe('the order of the dimensions', () => {
  let dimensionService;

  beforeAll(() => {
    dimensionService = require(DIMENSION_SERVICE);
  });

  // The comparator is the one the screen and the editor use
  // (packages/shared/taxonomy/sort.js): the three agree on the order.
  it('lists them by order, then the first declared first', async () => {
    await dimensionService.listDimensions({ user: adminA });
    models.TaxonomyDimensions.seed([
      {
        _company: COMPANY_A,
        name: 'audience',
        label: 'A',
        order: 21,
        createdAt: new Date('2026-11-02'),
      },
      {
        _company: COMPANY_A,
        name: 'brand',
        label: 'Z',
        order: 21,
        createdAt: new Date('2026-11-01'),
      },
      {
        _company: COMPANY_A,
        name: 'market',
        label: 'M',
        order: 15,
        createdAt: new Date('2026-11-03'),
      },
    ]);

    const listed = await dimensionService.listDimensions({ user: adminA });

    expect(listed.map((dimension) => dimension.name)).toEqual([
      'emailType',
      'market',
      'trigger',
      'brand',
      'audience',
    ]);
  });

  // The screen sends the next order itself; the server gives it to a
  // declaration that does not, so an API call does not land at 0, before the
  // standard ones.
  it('gives a dimension declared without an order the next one in the company', async () => {
    const audience = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'audience', label: 'Cible' },
    });
    const brand = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'brand', label: 'Marque' },
    });

    // The standard dimensions are seeded at 10 and 20.
    expect([audience.order, brand.order]).toEqual([21, 22]);
    const listed = await dimensionService.listDimensions({ user: adminA });
    expect(listed.map((dimension) => dimension.name)).toEqual([
      'emailType',
      'trigger',
      'audience',
      'brand',
    ]);
  });

  it('keeps the order the request gives', async () => {
    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: { name: 'audience', label: 'Cible', order: 5 },
      })
    ).resolves.toMatchObject({ order: 5 });
  });

  it("takes the next order within the company, whatever another company's", async () => {
    await dimensionService.createDimension({
      user: adminB,
      payload: { name: 'market', label: 'Market', order: 99 },
    });

    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: { name: 'audience', label: 'Cible' },
      })
    ).resolves.toMatchObject({ order: 21 });
  });
});
