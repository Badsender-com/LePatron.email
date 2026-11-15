'use strict';

// Token precedence as a list (#1558, ADR-0026): the dimension listed last wins
// a design token two values of one email carry. No number to type.

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
  adminB,
  techAdminA,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');

const declare = (payload, user = techAdminA) =>
  dimensionService.createDimension({ user, payload });

async function precedenceOf(user = techAdminA) {
  const dimensions = await dimensionService.listDimensions({ user });
  return Object.fromEntries(dimensions.map((d) => [d.name, d.precedence]));
}

beforeEach(async () => {
  resetTaxonomyModels(models);
  await declare({ name: 'brand', label: 'Marque' });
  await declare({ name: 'range', label: 'Gamme', parentName: 'brand' });
  await declare({ name: 'market', label: 'Marché' });
});

describe('token precedence', () => {
  const set = (names) =>
    dimensionService.setPrecedence({ user: techAdminA, names });

  it('ranks the dimensions listed, the last one highest', async () => {
    await set(['emailType', 'market', 'brand', 'range']);

    expect(await precedenceOf()).toMatchObject({
      emailType: 10,
      market: 20,
      brand: 30,
      range: 40,
    });
  });

  it('inverts the winner when the list is turned', async () => {
    await set(['range', 'brand']);

    const precedence = await precedenceOf();
    expect(precedence.brand).toBeGreaterThan(precedence.range);
  });

  it.each([
    ['the trigger', ['trigger', 'brand']],
    ['an unknown dimension', ['brand', 'season']],
    ['a dimension twice', ['brand', 'range', 'brand']],
    ['nothing', []],
  ])('refuses a list with %s, changing nothing', async (_case, names) => {
    const before = await precedenceOf();

    await expect(set(names)).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
    expect(await precedenceOf()).toEqual(before);
  });

  it("never touches another company's dimensions", async () => {
    await declare({ name: 'brand', label: 'Brand' }, adminB);

    await set(['range', 'brand']);

    expect((await precedenceOf(adminB)).brand).toBe(0);
  });
});
