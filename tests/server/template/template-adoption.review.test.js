'use strict';

// The bulk adoption of a template's emails (ADR-0024), cases the review of the
// stack found: a deactivated value the email carries, an email saved during
// the run, the template's own defaults, an id that is not one.

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
  idOf,
  idsOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const {
  TEMPLATE_READING_SILO_AND_BRAND,
} = require('./template-contract.fixtures.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');
const {
  adoptForTemplate,
} = require('../../../packages/server/template/template-adoption.service.js');

const TEMPLATE = '507f1f77bcf86cd799439f01';
const EMAIL = '507f1f77bcf86cd799439001';

const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });
const deactivate = (value) =>
  taxonomyService.updateTaxonomyItem({
    user: adminA,
    itemId: idOf(value),
    payload: { isActive: false },
  });
const seedEmail = (data, values = []) =>
  models.Mailings.seed([
    {
      _id: EMAIL,
      name: 'Back to school',
      _company: COMPANY_A,
      _wireframe: TEMPLATE,
      _taxonomyItems: values.map((value) => value._id),
      data,
    },
  ]);
const carriedBy = async () =>
  idsOf((await models.Mailings.findOne({ _id: EMAIL }).lean())._taxonomyItems);

let school;
let blueNotebooks;
let redNotebooks;

beforeEach(async () => {
  resetTaxonomyModels(models);
  models.Templates.reset();
  models.Templates.seed([
    {
      _id: TEMPLATE,
      _company: COMPANY_A,
      markup: TEMPLATE_READING_SILO_AND_BRAND,
    },
  ]);
  await dimensionService.createDimension({
    user: adminA,
    payload: { name: 'silo', label: 'Silo' },
  });
  await dimensionService.createDimension({
    user: adminA,
    payload: { name: 'siloBrand', label: 'Marque', parentName: 'silo' },
  });
  await addValue('silo', { label: 'Jeunesse', canonicalType: 'youth' });
  school = await addValue('silo', {
    label: 'Scolaire',
    canonicalType: 'school',
  });
  blueNotebooks = await addValue('siloBrand', {
    label: 'Cahiers Bleus',
    canonicalType: 'blue_notebooks',
    parentIds: [idOf(school)],
  });
  redNotebooks = await addValue('siloBrand', {
    label: 'Cahiers Rouges',
    canonicalType: 'red_notebooks',
    parentIds: [idOf(school)],
  });
});

describe('bulk adoption, after the review of the stack', () => {
  it('gives no second value to a dimension holding a deactivated one', async () => {
    seedEmail({ silo: 'school', brand_school: 'blue_notebooks' }, [
      school,
      redNotebooks,
    ]);
    await deactivate(redNotebooks);

    const report = await adoptForTemplate({
      templateId: TEMPLATE,
      apply: true,
    });

    expect(report.emails[0].adopted).toEqual({});
    expect((await carriedBy()).sort()).toEqual(
      [idOf(school), idOf(redNotebooks)].sort()
    );
  });

  it('does not count as attached an email saved during the run', async () => {
    seedEmail({ silo: 'school', brand_school: 'blue_notebooks' });
    const updateOne = models.Mailings.updateOne;
    // Saved by its author between the read and the write.
    models.Mailings.updateOne = async () => ({ matchedCount: 0 });

    try {
      const report = await adoptForTemplate({
        templateId: TEMPLATE,
        apply: true,
      });
      expect(report.counts).toEqual({
        attached: 0,
        withGaps: 0,
        complete: 0,
        skipped: 1,
      });
    } finally {
      models.Mailings.updateOne = updateOne;
    }
  });

  it("reads the template's own default for a property the email never saved", async () => {
    // The template declares silo=youth; the email saved no silo.
    seedEmail({});

    const report = await adoptForTemplate({
      templateId: TEMPLATE,
      apply: false,
    });

    expect(report.emails[0].adopted).toMatchObject({ silo: 'youth' });
  });

  it('answers not found for a template id that is not one', async () => {
    await expect(
      adoptForTemplate({ templateId: 'undefined', apply: false })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('still attaches the value the content holds when nothing is carried', async () => {
    seedEmail({ silo: 'school', brand_school: 'blue_notebooks' });

    await adoptForTemplate({ templateId: TEMPLATE, apply: true });

    expect((await carriedBy()).sort()).toEqual(
      [idOf(school), idOf(blueNotebooks)].sort()
    );
  });
});
