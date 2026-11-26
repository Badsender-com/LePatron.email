'use strict';

// Acceptance tests of the company boundary of the taxonomy (epic #1351,
// ADR-0032), and of the super admin acting for a company.
//
// Two companies may declare the same dimension name: everything a company
// counts, lists or checks is its own, and another company's records read as if
// they did not exist. A super admin acts for the company it names, or else for
// the one it has selected, never for its own.

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
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');
const {
  COMPANY_A,
  COMPANY_B,
  adminA,
  adminB,
  superAdmin,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

beforeEach(() => {
  resetTaxonomyModels(models);
  models.Groups.seed([{ _id: COMPANY_A }, { _id: COMPANY_B }]);
});

const declare = (payload, user = adminA, groupId) =>
  dimensionService.createDimension({ user, groupId, payload });

const addValue = (type, payload, user = adminA, groupId) =>
  taxonomyService.createTaxonomyItem({ user, groupId, type, payload });

const namesOf = (dimensions) =>
  dimensions.map((dimension) => dimension.name).sort();

const seedValues = (company, count) =>
  models.TaxonomyItems.seed(
    Array.from({ length: count }, (_, i) => ({
      _company: company,
      type: 'audience',
      label: `Segment ${i + 1}`,
    }))
  );

describe('the company boundary', () => {
  let audienceA;

  beforeEach(async () => {
    audienceA = await declare({ name: 'audience', label: 'Cible' });
    await declare({ name: 'audience', label: 'Audience' }, adminB);
  });

  it('deletes a dimension whatever values another company holds under its name', async () => {
    seedValues(COMPANY_B, 2);

    await dimensionService.deleteDimension({
      user: adminA,
      dimensionId: idOf(audienceA),
    });

    expect(
      namesOf(await dimensionService.listDimensions({ user: adminA }))
    ).toEqual(['emailType', 'trigger']);
  });

  it("counts only the company's own values when it refuses a delete", async () => {
    seedValues(COMPANY_A, 1);
    seedValues(COMPANY_B, 3);

    await expect(
      dimensionService.deleteDimension({
        user: adminA,
        dimensionId: idOf(audienceA),
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_HAS_VALUES,
      details: { valueCount: 1 },
    });
  });

  it("counts only the company's own values against the limit of 200", async () => {
    seedValues(COMPANY_B, 200);

    await expect(
      addValue('audience', { label: 'Clients VIP' })
    ).resolves.toMatchObject({ label: 'Clients VIP' });
  });

  it("counts only the company's own dimensions against the limit of 20", async () => {
    for (let i = 1; i <= 17; i += 1) {
      await declare({ name: `axis${i}`, label: `Axe ${i}` }, adminB);
    }

    await expect(
      declare({ name: 'brand', label: 'Marque' })
    ).resolves.toMatchObject({ name: 'brand' });
  });

  it("never lists another company's values under the same dimension name", async () => {
    await addValue('audience', { label: 'Prospects' }, adminB);
    await addValue('audience', { label: 'Clients VIP' });

    const values = await taxonomyService.listTaxonomyItems({
      user: adminA,
      type: 'audience',
    });

    expect(values.map((value) => value.label)).toEqual(['Clients VIP']);
  });

  it('refuses an admin naming another company, rather than answer its own', async () => {
    await expect(
      dimensionService.listDimensions({ user: adminA, groupId: COMPANY_B })
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION,
    });
    await expect(
      declare({ name: 'brand', label: 'Marque' }, adminA, COMPANY_B)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      addValue('audience', { label: 'VIP' }, adminA, COMPANY_B)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses to edit another company's value, as if it did not exist", async () => {
    const prospects = await addValue(
      'audience',
      { label: 'Prospects' },
      adminB
    );

    await expect(
      taxonomyService.updateTaxonomyItem({
        user: adminA,
        itemId: idOf(prospects),
        payload: { label: 'Mine now' },
      })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.TAXONOMY_ITEM_NOT_FOUND,
    });
  });
});

describe('a super admin', () => {
  it('lists the dimensions of the company it names, seeded there', async () => {
    await declare({ name: 'brand', label: 'Marque' }, adminB);

    const listed = await dimensionService.listDimensions({
      user: superAdmin,
      groupId: COMPANY_B,
    });

    expect(namesOf(listed)).toEqual(['brand', 'emailType', 'trigger']);
    listed.forEach((dimension) =>
      expect(String(dimension._company)).toBe(COMPANY_B)
    );
  });

  it('lists the company it selected when it names none', async () => {
    await declare({ name: 'brand', label: 'Marque' }, adminB);

    const listed = await dimensionService.listDimensions({
      user: { ...superAdmin, selectedGroup: { id: COMPANY_B } },
    });

    expect(namesOf(listed)).toEqual(['brand', 'emailType', 'trigger']);
  });

  it('declares a dimension and its values in the company it names', async () => {
    await declare({ name: 'brand', label: 'Marque' }, superAdmin, COMPANY_A);
    await addValue('brand', { label: 'Marque A' }, superAdmin, COMPANY_A);

    expect(
      namesOf(await dimensionService.listDimensions({ user: adminA }))
    ).toContain('brand');
    expect(
      namesOf(await dimensionService.listDimensions({ user: adminB }))
    ).not.toContain('brand');
    const values = await taxonomyService.listTaxonomyItems({
      user: adminA,
      type: 'brand',
    });
    expect(values.map((value) => value.label)).toEqual(['Marque A']);
  });

  it('edits and deletes a dimension of any company by its id', async () => {
    const brand = await declare({ name: 'brand', label: 'Marque' }, adminB);

    await expect(
      dimensionService.updateDimension({
        user: superAdmin,
        dimensionId: idOf(brand),
        payload: { label: 'Gamme' },
      })
    ).resolves.toMatchObject({ label: 'Gamme' });
    await dimensionService.deleteDimension({
      user: superAdmin,
      dimensionId: idOf(brand),
    });

    expect(
      namesOf(await dimensionService.listDimensions({ user: adminB }))
    ).toEqual(['emailType', 'trigger']);
  });

  it('never falls back on its own company when it names and selected none', async () => {
    await expect(
      dimensionService.listDimensions({ user: superAdmin })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.MISSING_GROUP_PARAM,
    });
    expect(models.TaxonomyDimensions.all()).toEqual([]);
  });

  it('refuses a company id that is not one', async () => {
    await expect(
      declare({ name: 'brand', label: 'Marque' }, superAdmin, 'companyAdmin')
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_GROUP_PARAM,
    });
  });
});
