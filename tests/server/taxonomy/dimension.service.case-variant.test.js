'use strict';

// Acceptance tests of the dimensions (epic #1351, ADR-0032 and ADR-0015): a
// name that differs from an existing one only by its case.
//
// A dimension is an axis a company declines its emails by. Two are standard, the
// email type and the email trigger; every other one is declared by the company.
// The collections are in-memory fakes that interpret queries like MongoDB, so
// these tests hold the service to its answers, not to the shape of its queries.
//
// As everywhere in the taxonomy (ADR-0032), a malformed request, or one naming
// something the company does not have, is a 400; a well-formed request that
// clashes with what is stored is a 409.

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
  adminB,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const DIMENSION_SERVICE =
  '../../../packages/server/taxonomy/services/dimension.service.js';

beforeEach(() => resetTaxonomyModels(models));

// `market` and `Market` are two properties for a template, and two lists of
// the same values in the editor: almost always a typo, never correctable
// later since the name is final.
describe('declaring a name that differs from an existing one only by its case', () => {
  let dimensionService;

  beforeAll(() => {
    dimensionService = require(DIMENSION_SERVICE);
  });

  it.each([
    ['market', 'Market'],
    ['trigger', 'Trigger'],
  ])(
    'refuses %s next to %s until the admin confirms it',
    async (existingName, name) => {
      if (existingName !== 'trigger') {
        await dimensionService.createDimension({
          user: adminA,
          payload: { name: existingName, label: 'Marché' },
        });
      }

      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: { name, label: 'Marché bis' },
        })
      ).rejects.toMatchObject({
        status: 409,
        message: ERROR_CODES.DIMENSION_NAME_DIFFERS_ONLY_BY_CASE,
        details: { existingName },
      });
      expect(
        models.TaxonomyDimensions.all().filter((d) => d.name === name)
      ).toHaveLength(0);
    }
  );

  it('declares it once the admin confirms', async () => {
    await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'market', label: 'Marché' },
    });

    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: {
          name: 'Market',
          label: 'Marché bis',
          confirmCaseVariant: true,
        },
      })
    ).resolves.toMatchObject({ name: 'Market', label: 'Marché bis' });
  });

  it('still refuses the exact same name, confirmed or not', async () => {
    await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'market', label: 'Marché' },
    });

    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: {
          name: 'market',
          label: 'Marché',
          confirmCaseVariant: true,
        },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_NAME_ALREADY_EXISTS,
    });
  });

  it('compares within the company only', async () => {
    await dimensionService.createDimension({
      user: adminB,
      payload: { name: 'market', label: 'Market' },
    });

    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: { name: 'Market', label: 'Marché' },
      })
    ).resolves.toMatchObject({ name: 'Market' });
  });

  it('refuses a confirmation that is not a boolean', async () => {
    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: {
          name: 'market',
          label: 'Marché',
          confirmCaseVariant: 'yes',
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });
});
