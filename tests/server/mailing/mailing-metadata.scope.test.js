'use strict';

// Acceptance tests of what the scope of a dimension changes on an email (epic
// #1514, ADR-0024). A dimension restricted to "the templates reading it" is
// offered on an email when the email's template contract names it, or reads a
// design token one of its values carries. Out of scope is treated like
// deactivated (ADR-0014): kept on the email, not offered, not sent to the AI.

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
  TEMPLATE_READING_MARKET,
} = require('../template/template-contract.fixtures.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');
const {
  buildEditorMetadata,
} = require('../../../packages/server/mailing/mailing-editor-metadata.service.js');
const {
  buildGovernanceContext,
} = require('../../../packages/server/taxonomy/services/governance-context.service.js');
const {
  dimensionSelects,
} = require('../../../packages/editor/src/js/utils/dimension-selects.js');

const SILO_TEMPLATE = '507f1f77bcf86cd799439f01';
const MARKET_TEMPLATE = '507f1f77bcf86cd799439f02';
const BRAND_ONLY_TEMPLATE = '507f1f77bcf86cd799439f03';

const companyA = { _id: COMPANY_A, emailMetadata: { enabled: true } };

const declare = (payload) =>
  dimensionService.createDimension({ user: adminA, payload });
const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });

let youth;
let school;
let littleReader;
let blueNotebooks;
let belgium;

beforeEach(async () => {
  resetTaxonomyModels(models);
  models.Templates.reset();
  models.Templates.seed([
    {
      _id: SILO_TEMPLATE,
      _company: COMPANY_A,
      markup: TEMPLATE_READING_SILO_AND_BRAND,
    },
    {
      _id: MARKET_TEMPLATE,
      _company: COMPANY_A,
      markup: TEMPLATE_READING_MARKET,
    },
    {
      _id: BRAND_ONLY_TEMPLATE,
      _company: COMPANY_A,
      markup: '<p data-ko-display="_root_.siloBrand eq \'atlas\'">Atlas</p>',
    },
  ]);

  const rendering = { scope: 'readingTemplates' };
  await declare({ name: 'silo', label: 'Silo', ...rendering });
  await declare({
    name: 'siloBrand',
    label: 'Marque',
    parentName: 'silo',
    ...rendering,
  });
  await declare({ name: 'market', label: 'Marché', ...rendering });
  await declare({ name: 'edition', label: 'Édition', ...rendering });
  await declare({ name: 'audience', label: 'Cible' });

  youth = await addValue('silo', { label: 'Jeunesse', canonicalType: 'youth' });
  school = await addValue('silo', {
    label: 'Scolaire',
    canonicalType: 'school',
  });
  littleReader = await addValue('siloBrand', {
    label: 'Petit Lecteur',
    canonicalType: 'little_reader',
    parentIds: [idOf(youth)],
  });
  blueNotebooks = await addValue('siloBrand', {
    label: 'Cahiers Bleus',
    canonicalType: 'blue_notebooks',
    parentIds: [idOf(school)],
  });
  belgium = await addValue('market', {
    label: 'Belgique',
    canonicalType: 'be',
  });
  // Never named by a template: offered where a template reads its token.
  await addValue('edition', {
    label: 'Collector',
    tokens: { ctaColorVar: '#b8860b' },
  });
  await addValue('audience', {
    label: 'Enseignants',
    canonicalType: 'teachers',
  });
});

const emailOn = (templateId, values = []) => ({
  _id: '507f1f77bcf86cd799439e01',
  _company: COMPANY_A,
  _wireframe: templateId,
  _taxonomyItems: values.map((value) => value._id),
});

const offered = async (mailing) =>
  (
    await buildEditorMetadata({ mailing, group: companyA })
  ).emailMetadataConfig.dimensions.map((dimension) => dimension.name);

// Turned on by #1521 (a dimension has a scope)
describe.skip('the editor offers the dimensions in scope', () => {
  it('offers the dimensions the template reads, and those offered on every email', async () => {
    expect((await offered(emailOn(SILO_TEMPLATE))).sort()).toEqual([
      'audience',
      'edition',
      'silo',
      'siloBrand',
    ]);
  });

  it('does not offer a rendering dimension the template never reads', async () => {
    expect((await offered(emailOn(MARKET_TEMPLATE))).sort()).toEqual([
      'audience',
      'market',
    ]);
  });

  it('offers a dimension whose values carry a design token the template reads', async () => {
    expect(await offered(emailOn(SILO_TEMPLATE))).toContain('edition');
    expect(await offered(emailOn(MARKET_TEMPLATE))).not.toContain('edition');
  });

  it('offers a child whose parent is out of scope with all its values', async () => {
    const { emailMetadataConfig } = await buildEditorMetadata({
      mailing: emailOn(BRAND_ONLY_TEMPLATE),
      group: companyA,
    });

    const selects = dimensionSelects({
      dimensions: emailMetadataConfig.dimensions,
      selections: {},
    });
    const brand = selects.find((select) => select.name === 'siloBrand');
    expect(brand.options.map((option) => option.label).sort()).toEqual([
      'Cahiers Bleus',
      'Petit Lecteur',
    ]);
  });

  it('keeps on the email a value of a dimension out of its scope', async () => {
    const mailing = emailOn(MARKET_TEMPLATE, [belgium, school, blueNotebooks]);

    const { emailMetadata } = await buildEditorMetadata({
      mailing,
      group: companyA,
    });

    expect(idsOf(emailMetadata.taxonomyItemIds).sort()).toEqual(
      [idOf(belgium), idOf(school), idOf(blueNotebooks)].sort()
    );
  });

  it('offers the dimension again once the template reads it', async () => {
    const mailing = emailOn(MARKET_TEMPLATE, [school]);
    expect(await offered(mailing)).not.toContain('silo');

    // Replaced as a template saved before ADR-0024 would be: new markup, no
    // contract stored yet, so it is read on first need.
    await models.Templates.updateOne(
      { _id: MARKET_TEMPLATE },
      {
        $set: { markup: TEMPLATE_READING_SILO_AND_BRAND },
        $unset: { contract: '' },
      }
    );

    expect(await offered(mailing)).toContain('silo');
  });
});

// Turned on by #1521 (a dimension has a scope)
describe.skip('governance context: dimensions out of scope', () => {
  it('leaves out, and does not count as missing, a dimension the template does not read', async () => {
    const context = await buildGovernanceContext({
      mailing: emailOn(MARKET_TEMPLATE, [belgium, school, littleReader]),
      lang: 'fr',
    });

    const named = context.dimensions.map((dimension) => dimension.name);
    expect(named).toContain('market');
    expect(named).not.toContain('silo');
    expect(named).not.toContain('siloBrand');
    expect(context.missing).not.toContain('silo');
    expect(context.missing).toContain('audience');
  });

  it('says the values of the dimensions the template reads', async () => {
    const context = await buildGovernanceContext({
      mailing: emailOn(SILO_TEMPLATE, [youth, littleReader]),
      lang: 'fr',
    });

    expect(context.text).toContain('### Silo : Jeunesse');
    expect(context.text).toContain('### Marque : Petit Lecteur');
    expect(context.missing).not.toContain('market');
  });
});
