'use strict';

// Acceptance tests of the bulk adoption of a template's emails (epic #1515,
// ADR-0024). The super admin previews, for every email of a template, what
// adoption would set and what it cannot, then applies it. Applying writes
// taxonomy values only, on empty dimensions only, never the content.
//
// Counts: `attached` emails got values and have no gap; `withGaps` have at least
// one gap; `complete` had nothing left to adopt.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
// The routes are read for their guards only.
jest.mock(
  '../../../packages/server/template/template.controller.js',
  () => new Proxy({}, { get: () => jest.fn() })
);

const models = require('../../../packages/server/common/models.common.js');
const {
  COMPANY_A,
  adminA,
  idOf,
  idsOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const { routeInspector } = require('../../helpers/express-router.js');
const {
  TEMPLATE_READING_SILO_AND_BRAND,
} = require('./template-contract.fixtures.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const TEMPLATE = '507f1f77bcf86cd799439f01';
const OTHER_TEMPLATE = '507f1f77bcf86cd799439f02';
const email = (n) => `507f1f77bcf86cd7994390${String(n).padStart(2, '0')}`;

const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });

let school;
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
    { _id: OTHER_TEMPLATE, _company: COMPANY_A, markup: '<p>Plain</p>' },
  ]);
  await dimensionService.createDimension({
    user: adminA,
    payload: { name: 'silo', label: 'Silo' },
  });
  await dimensionService.createDimension({
    user: adminA,
    payload: { name: 'siloBrand', label: 'Marque', parentName: 'silo' },
  });
  const youth = await addValue('silo', {
    label: 'Jeunesse',
    canonicalType: 'youth',
  });
  school = await addValue('silo', {
    label: 'Scolaire',
    canonicalType: 'school',
  });
  await addValue('siloBrand', {
    label: 'Petit Lecteur',
    canonicalType: 'little_reader',
    parentIds: [idOf(youth)],
  });
  await addValue('siloBrand', {
    label: 'Cahiers Bleus',
    canonicalType: 'blue_notebooks',
    parentIds: [idOf(school)],
  });
  redNotebooks = await addValue('siloBrand', {
    label: 'Cahiers Rouges',
    canonicalType: 'red_notebooks',
    parentIds: [idOf(school)],
  });

  const onTemplate = (n, name, data, values = []) => ({
    _id: email(n),
    name,
    _company: COMPANY_A,
    _wireframe: TEMPLATE,
    _taxonomyItems: values,
    data: { type: 'template', ...data },
  });
  models.Mailings.seed([
    onTemplate(1, 'Youth newsletter', {
      silo: 'youth',
      brand_youth: 'little_reader',
    }),
    // Moved from the youth silo to the school one: stale brand_youth left.
    onTemplate(2, 'Back to school', {
      silo: 'school',
      brand_youth: 'little_reader',
      brand_school: 'blue_notebooks',
    }),
    onTemplate(3, 'Cookery', { silo: 'cookery' }),
    onTemplate(
      4,
      'Already attached',
      { silo: 'school', brand_school: 'blue_notebooks' },
      [school._id, redNotebooks._id]
    ),
    {
      _id: email(5),
      name: 'Another template',
      _company: COMPANY_A,
      _wireframe: OTHER_TEMPLATE,
      data: { silo: 'youth' },
    },
  ]);
});

const adoptForTemplate = (params) =>
  require('../../../packages/server/template/template-adoption.service.js').adoptForTemplate(
    { templateId: TEMPLATE, ...params }
  );
const entryNamed = (report, name) =>
  report.emails.find((entry) => entry.name === name);

// Turned on by #1526 (preview the adoption of a template's emails)
describe.skip('bulk adoption: preview', () => {
  it('lists what adoption would set on every email of the template, and only those', async () => {
    const report = await adoptForTemplate({ apply: false });

    expect(report.emails.map((entry) => entry.name).sort()).toEqual([
      'Already attached',
      'Back to school',
      'Cookery',
      'Youth newsletter',
    ]);
    expect(entryNamed(report, 'Youth newsletter').adopted).toEqual({
      silo: 'youth',
      siloBrand: 'little_reader',
    });
    expect(entryNamed(report, 'Back to school').adopted).toEqual({
      silo: 'school',
      siloBrand: 'blue_notebooks',
    });
  });

  it('lists the emails it cannot attach, and why', async () => {
    const report = await adoptForTemplate({ apply: false });

    expect(entryNamed(report, 'Cookery').gaps).toEqual([
      {
        dimension: 'silo',
        identifier: 'cookery',
        reason: 'UNKNOWN_IDENTIFIER',
      },
    ]);
  });

  it('counts the emails it would attach, those with a gap, and the complete ones', async () => {
    expect((await adoptForTemplate({ apply: false })).counts).toEqual({
      attached: 2,
      withGaps: 1,
      complete: 1,
    });
  });

  it('writes nothing', async () => {
    await adoptForTemplate({ apply: false });

    expect(
      idsOf(
        (await models.Mailings.findOne({ _id: email(1) }).lean())._taxonomyItems
      )
    ).toEqual([]);
  });

  it('is open to the super admin only', () => {
    const router = require('../../../packages/server/template/template.routes.js');
    const {
      GUARD_ADMIN,
    } = require('../../../packages/server/account/auth.guard.js');

    expect(
      routeInspector(router).guardsOf('get', '/:templateId/adoption')
    ).toContain(GUARD_ADMIN);
  });
});

// Turned on by #1527 (apply the adoption to a template's emails)
describe.skip('bulk adoption: apply', () => {
  it('attaches each email to the values its content holds', async () => {
    await adoptForTemplate({ apply: true });

    const report = await adoptForTemplate({ apply: false });
    expect(entryNamed(report, 'Youth newsletter').adopted).toEqual({});
    expect(report.counts).toEqual({ attached: 0, withGaps: 1, complete: 3 });
  });

  it('never replaces a value an email carries', async () => {
    await adoptForTemplate({ apply: true });

    const attached = await models.Mailings.findOne({ _id: email(4) }).lean();
    expect(idsOf(attached._taxonomyItems).sort()).toEqual(
      [idOf(school), idOf(redNotebooks)].sort()
    );
  });

  it("never touches an email's content", async () => {
    const before = (await models.Mailings.findOne({ _id: email(2) }).lean())
      .data;

    await adoptForTemplate({ apply: true });

    expect(
      (await models.Mailings.findOne({ _id: email(2) }).lean()).data
    ).toEqual(before);
  });

  it('reports what it did', async () => {
    expect((await adoptForTemplate({ apply: true })).counts).toEqual({
      attached: 2,
      withGaps: 1,
      complete: 1,
    });
  });

  it('changes nothing when run a second time', async () => {
    await adoptForTemplate({ apply: true });
    const again = await adoptForTemplate({ apply: true });

    expect(again.counts).toEqual({ attached: 0, withGaps: 1, complete: 3 });
  });

  it('is open to the super admin only', () => {
    const router = require('../../../packages/server/template/template.routes.js');
    const {
      GUARD_ADMIN,
    } = require('../../../packages/server/account/auth.guard.js');

    expect(
      routeInspector(router).guardsOf('post', '/:templateId/adoption')
    ).toContain(GUARD_ADMIN);
  });
});
