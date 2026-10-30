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
  adminB,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const DIMENSION_SERVICE =
  '../../../packages/server/taxonomy/services/dimension.service.js';

beforeEach(() => resetTaxonomyModels(models));

const byName = (dimensions, name) =>
  dimensions.find((dimension) => dimension.name === name);

// Turned on by #1353 (dimensions are records; the email type and the trigger as
// standard dimensions)
describe('standard dimensions', () => {
  let dimensionService;

  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist until
    // #1353 ships it, and a top-level require would break the suite.
    dimensionService = require(DIMENSION_SERVICE);
  });

  it('gives a company the email type and the trigger the first time it lists its dimensions', async () => {
    const dimensions = await dimensionService.listDimensions({ user: adminA });

    expect(dimensions.map((dimension) => dimension.name).sort()).toEqual([
      'emailType',
      'trigger',
    ]);
    dimensions.forEach((dimension) =>
      expect(dimension).toMatchObject({ standard: true, isActive: true })
    );
  });

  it('labels them in words a company admin reads', async () => {
    const dimensions = await dimensionService.listDimensions({ user: adminA });

    expect(byName(dimensions, 'emailType').label).toBeTruthy();
    expect(byName(dimensions, 'trigger').label).toBeTruthy();
  });

  it('does not create them twice when the list is read again', async () => {
    await dimensionService.listDimensions({ user: adminA });
    const again = await dimensionService.listDimensions({ user: adminA });

    expect(again).toHaveLength(2);
  });

  it('keeps each company to its own dimensions', async () => {
    const ofA = await dimensionService.listDimensions({ user: adminA });
    const ofB = await dimensionService.listDimensions({ user: adminB });

    const idsOfA = ofA.map(idOf);
    ofB.forEach((dimension) => expect(idsOfA).not.toContain(idOf(dimension)));
  });

  it('refuses to rename a standard dimension', async () => {
    const dimensions = await dimensionService.listDimensions({ user: adminA });

    await expect(
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(byName(dimensions, 'emailType')),
        payload: { name: 'typology' },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.DIMENSION_NAME_IS_FINAL,
    });
  });

  it.each(['emailType', 'trigger'])(
    'refuses to deactivate the %s dimension',
    async (name) => {
      const dimensions = await dimensionService.listDimensions({
        user: adminA,
      });

      await expect(
        dimensionService.updateDimension({
          user: adminA,
          dimensionId: idOf(byName(dimensions, name)),
          payload: { isActive: false },
        })
      ).rejects.toMatchObject({
        status: 409,
        message: ERROR_CODES.STANDARD_DIMENSION_LOCKED,
      });
    }
  );

  it.each(['emailType', 'trigger'])(
    'refuses to delete the %s dimension',
    async (name) => {
      const dimensions = await dimensionService.listDimensions({
        user: adminA,
      });

      await expect(
        dimensionService.deleteDimension({
          user: adminA,
          dimensionId: idOf(byName(dimensions, name)),
        })
      ).rejects.toMatchObject({
        status: 409,
        message: ERROR_CODES.STANDARD_DIMENSION_LOCKED,
      });
    }
  );

  it('lets a company word a standard dimension its own way', async () => {
    const dimensions = await dimensionService.listDimensions({ user: adminA });

    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(byName(dimensions, 'emailType')),
      payload: {
        label: 'Famille de message',
        description: 'Ce que le message apporte au client.',
        order: 5,
        precedence: 40,
      },
    });

    const updated = byName(
      await dimensionService.listDimensions({ user: adminA }),
      'emailType'
    );
    expect(updated).toMatchObject({
      label: 'Famille de message',
      description: 'Ce que le message apporte au client.',
      order: 5,
      precedence: 40,
    });
  });

  it("refuses to edit another company's dimension, as if it did not exist", async () => {
    const ofA = await dimensionService.listDimensions({ user: adminA });

    await expect(
      dimensionService.updateDimension({
        user: adminB,
        dimensionId: idOf(byName(ofA, 'emailType')),
        payload: { label: 'Piraté' },
      })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.DIMENSION_NOT_FOUND,
    });
  });
});
