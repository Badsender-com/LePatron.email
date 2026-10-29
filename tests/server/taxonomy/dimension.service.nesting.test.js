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
  adminA,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const DIMENSION_SERVICE =
  '../../../packages/server/taxonomy/services/dimension.service.js';

beforeEach(() => resetTaxonomyModels(models));

// Turned on by #1358 (nested dimensions and availability)
describe.skip('nesting a dimension', () => {
  let dimensionService;
  let market;
  let language;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1353.
    dimensionService = require(DIMENSION_SERVICE);
  });

  beforeEach(async () => {
    market = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'market', label: 'Marché' },
    });
    language = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'language', label: 'Langue' },
    });
  });

  it('hangs a dimension under another one', async () => {
    const nested = await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(language),
      payload: { parentName: 'market' },
    });

    expect(nested).toMatchObject({ name: 'language', parentName: 'market' });
  });

  it('declares a dimension directly under its parent', async () => {
    const programme = await dimensionService.createDimension({
      user: adminA,
      payload: {
        name: 'programme',
        label: 'Programme',
        parentName: 'emailType',
      },
    });

    // Under the email type: its values are real values, so they can offer others.
    expect(programme).toMatchObject({ parentName: 'emailType' });
  });

  it('takes a dimension back to the first level', async () => {
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(language),
      payload: { parentName: 'market' },
    });

    const flat = await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(language),
      payload: { parentName: null },
    });

    expect(flat.parentName).toBeFalsy();
  });

  it.each([
    ['the trigger, whose values are not stored', 'trigger'],
    ['itself', 'language'],
    ['a dimension the company has not declared', 'country'],
  ])('refuses to hang it under %s', async (_, parentName) => {
    await expect(
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(language),
        payload: { parentName },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });

  it('refuses a cycle: a market under its own language', async () => {
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(language),
      payload: { parentName: 'market' },
    });

    await expect(
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(market),
        payload: { parentName: 'language' },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });

  it('refuses a deactivated parent', async () => {
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(market),
      payload: { isActive: false },
    });

    await expect(
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(language),
        payload: { parentName: 'market' },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });
});

// Turned on by #1359 (design tokens and precedence)
describe.skip('precedence', () => {
  let dimensionService;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1353.
    dimensionService = require(DIMENSION_SERVICE);
  });

  it('sets the precedence of a company dimension', async () => {
    const brand = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'brand', label: 'Marque' },
    });

    const updated = await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(brand),
      payload: { precedence: 10 },
    });

    expect(updated.precedence).toBe(10);
  });

  it.each(['high', null, Number.NaN])(
    'refuses %p as a precedence',
    async (precedence) => {
      const brand = await dimensionService.createDimension({
        user: adminA,
        payload: { name: 'brand', label: 'Marque' },
      });

      await expect(
        dimensionService.updateDimension({
          user: adminA,
          dimensionId: idOf(brand),
          payload: { precedence },
        })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_DIMENSION,
      });
    }
  );
});
