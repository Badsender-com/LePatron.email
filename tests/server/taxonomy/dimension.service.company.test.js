'use strict';

// The company a dimension request acts for (epic #1351, ADR-0032).
//
// A super admin names the company; anyone else acts for their own, and naming
// another one is refused rather than redirected. The collections are in-memory
// fakes that interpret queries like MongoDB.

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
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const {
  COMPANY_A,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const PLATFORM = '507f1f77bcf86cd799439f01';
const NO_COMPANY = '507f1f77bcf86cd799439e01';
const superAdmin = { role: 'super_admin', group: { id: PLATFORM } };

beforeEach(() => resetTaxonomyModels(models));

const companiesWithDimensions = () =>
  new Set(models.TaxonomyDimensions.all().map((d) => String(d._company)));

describe('the company a dimension request acts for', () => {
  describe('a super admin', () => {
    beforeEach(() => models.Groups.seed([{ _id: COMPANY_A, name: 'A' }]));

    it('lists the dimensions of the company it names, seeded on first read', async () => {
      const listed = await dimensionService.listDimensions({
        user: superAdmin,
        groupId: COMPANY_A,
      });

      expect(listed.map((d) => d.name).sort()).toEqual([
        'emailType',
        'trigger',
      ]);
      expect(companiesWithDimensions()).toEqual(new Set([COMPANY_A]));
    });

    it('answers 404 for an id no company has, and seeds nothing', async () => {
      await expect(
        dimensionService.listDimensions({
          user: superAdmin,
          groupId: NO_COMPANY,
        })
      ).rejects.toMatchObject({
        status: 404,
        message: ERROR_CODES.GROUP_NOT_FOUND,
      });
      expect(models.TaxonomyDimensions.all()).toHaveLength(0);
    });

    it('declares nothing either for an id no company has', async () => {
      await expect(
        dimensionService.createDimension({
          user: superAdmin,
          groupId: NO_COMPANY,
          payload: { name: 'audience', label: 'Cible' },
        })
      ).rejects.toMatchObject({ status: 404 });
      expect(models.TaxonomyDimensions.all()).toHaveLength(0);
    });

    it('declares a dimension for the company it names', async () => {
      await expect(
        dimensionService.createDimension({
          user: superAdmin,
          groupId: COMPANY_A,
          payload: { name: 'audience', label: 'Cible' },
        })
      ).resolves.toMatchObject({ name: 'audience' });
      expect(companiesWithDimensions()).toEqual(new Set([COMPANY_A]));
    });
  });
});
