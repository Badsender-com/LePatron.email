'use strict';

// A role given or changed when values already carry codes (ADR-0023): a code
// is read under the role of its dimension, so a role under which a code would
// mean something else is refused rather than silently reinterpreted.

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
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const setRole = (dimension, role) =>
  dimensionService.updateDimension({
    user: adminA,
    dimensionId: idOf(dimension),
    payload: { role },
  });

describe('changing the role of a dimension whose values carry codes', () => {
  let market;
  let language;

  beforeEach(async () => {
    resetTaxonomyModels(models);
    market = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'market', label: 'Marché', role: 'country' },
    });
    language = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'language', label: 'Langue', role: 'language' },
    });
    await taxonomyService.createTaxonomyItem({
      user: adminA,
      type: 'market',
      payload: { label: 'Belgique', code: 'BE' },
    });
    await taxonomyService.createTaxonomyItem({
      user: adminA,
      type: 'language',
      payload: { label: 'Français', code: 'fr' },
    });
  });

  it('refuses a role under which a code would mean something else: BE is no locale', async () => {
    await expect(setRole(market, 'locale')).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_HAS_CODES,
      details: { valueCount: 1 },
    });
  });

  it('refuses it after a detour through no role', async () => {
    await setRole(market, null);
    await setRole(language, null);

    // fr would read as France.
    await expect(setRole(language, 'country')).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_HAS_CODES,
    });
  });

  it('accepts a role under which every code keeps its meaning: fr is a locale', async () => {
    const moved = await setRole(language, 'locale');

    expect(moved.role).toBe('locale');
  });

  it('gives a role back after a detour through none', async () => {
    await setRole(market, null);

    expect((await setRole(market, 'country')).role).toBe('country');
  });
});
