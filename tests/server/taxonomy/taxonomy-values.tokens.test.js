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
  plainTokens,
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

// Turned on by #1359 (design tokens and precedence)
describe.skip('design tokens', () => {
  beforeAll(loadServices);

  beforeEach(async () => {
    await declare({ name: 'brand', label: 'Marque' });
  });

  it('gives a value its design tokens', async () => {
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845', textColorVar: '#1a1a1a' },
    });

    expect(plainTokens(brand.tokens)).toEqual({
      mainColorVar: '#ffd845',
      textColorVar: '#1a1a1a',
    });
  });

  it('replaces the tokens of a value on edit', async () => {
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845' },
    });

    const edited = await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(brand),
      payload: { tokens: { accentColorVar: '#0050ff' } },
    });

    expect(plainTokens(edited.tokens)).toEqual({ accentColorVar: '#0050ff' });
  });

  it('refuses the 25th token of a value, naming the limit', async () => {
    const tokens = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`color${i}`, '#000000'])
    );

    await expect(
      addValue('brand', { label: 'Marque A', tokens })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_LIMIT_REACHED,
      details: { limit: 24 },
    });
  });

  it.each(['main-color', '1color', 'main color'])(
    'refuses a token named %p, which no template could read',
    async (name) => {
      await expect(
        addValue('brand', { label: 'Marque A', tokens: { [name]: '#000' } })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
      });
    }
  );
});
