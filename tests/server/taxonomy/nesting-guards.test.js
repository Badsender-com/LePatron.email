'use strict';

// What nesting refuses beyond the acceptance tests: nothing that would leave a
// dimension or a value pointing at nothing is done silently (ADR-0014).

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
  idOf,
  idsOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');
const metadataService = require('../../../packages/server/mailing/mailing-metadata.service.js');

const declare = (payload) =>
  dimensionService.createDimension({ user: adminA, payload });
const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });
const dimensionNamed = async (name) =>
  (await dimensionService.listDimensions({ user: adminA })).find(
    (dimension) => dimension.name === name
  );

describe('nesting: what is refused rather than left dangling', () => {
  let market;
  let language;
  let canada;

  beforeEach(async () => {
    resetTaxonomyModels(models);
    market = await declare({ name: 'market', label: 'Marché' });
    language = await declare({
      name: 'language',
      label: 'Langue',
      parentName: 'market',
    });
    canada = await addValue('market', { label: 'Canada' });
  });

  it('refuses to delete a dimension another one hangs under', async () => {
    // Emptied first: a dimension with values is refused for that reason.
    await taxonomyService.deleteTaxonomyItem({
      user: adminA,
      itemId: idOf(canada),
    });

    await expect(
      dimensionService.deleteDimension({
        user: adminA,
        dimensionId: idOf(market),
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_HAS_CHILDREN,
      details: { childNames: ['language'] },
    });
  });

  it('refuses to move a dimension whose values carry an availability, giving their count', async () => {
    await declare({ name: 'brand', label: 'Marque' });
    await addValue('language', {
      label: 'Français',
      parentIds: [idOf(canada)],
    });

    await expect(
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(language),
        payload: { parentName: 'brand' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_HAS_AVAILABILITY,
      details: { valueCount: 1 },
    });
  });

  it('moves a dimension whose values are offered everywhere', async () => {
    await declare({ name: 'brand', label: 'Marque' });
    await addValue('language', { label: 'Anglais' });

    const moved = await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(language),
      payload: { parentName: 'brand' },
    });

    expect(moved.parentName).toBe('brand');
  });

  it('hangs a standard dimension under nothing', async () => {
    await expect(
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(await dimensionNamed('emailType')),
        payload: { parentName: 'market' },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });

  it('checks a value under the email type again when only the email type changes', async () => {
    await declare({
      name: 'programme',
      label: 'Programme',
      parentName: 'emailType',
    });
    const promotional = await addValue('emailType', { label: 'Promotion' });
    const editorial = await addValue('emailType', { label: 'Infolettre' });
    const loyalty = await addValue('programme', {
      label: 'Fidélité',
      parentIds: [idOf(promotional)],
    });
    const mailing = {
      _company: COMPANY_A,
      _emailType: promotional._id,
      _taxonomyItems: [loyalty._id],
    };

    await expect(
      metadataService.applyMetadataToMailing(mailing, {
        emailTypeId: idOf(editorial),
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
    expect(idsOf(mailing._taxonomyItems)).toEqual([idOf(loyalty)]);
  });

  it('offers a value of a dimension whose parent is deactivated everywhere', async () => {
    const french = await addValue('language', {
      label: 'Français',
      parentIds: [idOf(canada)],
    });
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(market),
      payload: { isActive: false },
    });
    const mailing = { _company: COMPANY_A };

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(french)],
    });

    expect(idsOf(mailing._taxonomyItems)).toEqual([idOf(french)]);
  });
});
