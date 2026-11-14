'use strict';

// Acceptance tests of the default values a company sets (epic #1514, ADR-0024):
// one value by default at the first level; for a child dimension, one value
// "default under" each parent value. Applied when an email is created, by the
// editor or by the server, and never retroactively.

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

const SILO_TEMPLATE = '507f1f77bcf86cd799439f01';
const MARKET_TEMPLATE = '507f1f77bcf86cd799439f02';

const declare = (payload) =>
  dimensionService.createDimension({ user: adminA, payload });
const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });
const editValue = (value, payload) =>
  taxonomyService.updateTaxonomyItem({
    user: adminA,
    itemId: idOf(value),
    payload,
  });

let youth;
let school;
let littleReader;
let blueNotebooks;
let redNotebooks;

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
  ]);
  await declare({ name: 'silo', label: 'Silo' });
  await declare({ name: 'siloBrand', label: 'Marque', parentName: 'silo' });
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
  redNotebooks = await addValue('siloBrand', {
    label: 'Cahiers Rouges',
    canonicalType: 'red_notebooks',
    parentIds: [idOf(school)],
  });
});

const defaultsForNewEmail = (templateId) =>
  require('../../../packages/server/taxonomy/services/default-values.service.js').defaultValuesForNewEmail(
    { companyId: COMPANY_A, templateId }
  );

// Turned on by #1523 (a default value at the first level)
describe.skip('default value at the first level', () => {
  it('marks a value as the default of its dimension', async () => {
    expect((await editValue(school, { isDefault: true })).isDefault).toBe(true);
  });

  it('refuses a second default, naming the value holding the place', async () => {
    await editValue(school, { isDefault: true });

    await expect(editValue(youth, { isDefault: true })).rejects.toMatchObject({
      status: 409,
      message: 'TAXONOMY_DEFAULT_TAKEN',
      details: { holder: 'Scolaire' },
    });
  });

  it('lets the default move once the first one is unmarked', async () => {
    await editValue(school, { isDefault: true });
    await editValue(school, { isDefault: false });

    expect((await editValue(youth, { isDefault: true })).isDefault).toBe(true);
  });

  it("gives an email created on a template its company's default", async () => {
    await editValue(school, { isDefault: true });

    expect(idsOf(await defaultsForNewEmail(MARKET_TEMPLATE))).toContain(
      idOf(school)
    );
  });

  it("gives an email created on a template the template's own default first", async () => {
    // The silo template declares silo=youth.
    await editValue(school, { isDefault: true });

    const ids = idsOf(await defaultsForNewEmail(SILO_TEMPLATE));
    expect(ids).toContain(idOf(youth));
    expect(ids).not.toContain(idOf(school));
  });

  it('changes nothing on an email that already exists', async () => {
    const existing = {
      _id: '507f1f77bcf86cd799439e01',
      _company: COMPANY_A,
      _wireframe: MARKET_TEMPLATE,
      _taxonomyItems: [],
    };
    await editValue(school, { isDefault: true });

    const { emailMetadata } = await buildEditorMetadata({
      mailing: existing,
      group: { _id: COMPANY_A, emailMetadata: { enabled: true } },
    });
    expect(emailMetadata.taxonomyItemIds).toEqual([]);
  });
});

// Turned on by #1524 (the default value of a child dimension)
describe.skip('default value of a child dimension', () => {
  it('marks a brand as the default under a silo it is offered under', async () => {
    const marked = await editValue(redNotebooks, {
      defaultUnder: [idOf(school)],
    });

    expect(idsOf(marked.defaultUnder)).toEqual([idOf(school)]);
  });

  it('refuses a default under a silo the brand is not offered under', async () => {
    await expect(
      editValue(littleReader, { defaultUnder: [idOf(school)] })
    ).rejects.toMatchObject({
      status: 400,
      message: 'TAXONOMY_DEFAULT_UNDER_NOT_OFFERED',
    });
  });

  it('refuses a second default under the same silo, naming the holder', async () => {
    await editValue(redNotebooks, { defaultUnder: [idOf(school)] });

    await expect(
      editValue(blueNotebooks, { defaultUnder: [idOf(school)] })
    ).rejects.toMatchObject({
      status: 409,
      message: 'TAXONOMY_DEFAULT_TAKEN',
      details: { holder: 'Cahiers Rouges' },
    });
  });

  it('lets a brand offered under every silo be the default under any of them', async () => {
    const guide = await addValue('siloBrand', { label: 'Guide' });

    const marked = await editValue(guide, {
      defaultUnder: [idOf(youth), idOf(school)],
    });
    expect(idsOf(marked.defaultUnder).sort()).toEqual(
      [idOf(youth), idOf(school)].sort()
    );
  });

  it('gives an email created on a template the default brand of its silo', async () => {
    await editValue(school, { isDefault: true });
    await editValue(redNotebooks, { defaultUnder: [idOf(school)] });

    expect(idsOf(await defaultsForNewEmail(MARKET_TEMPLATE)).sort()).toEqual(
      [idOf(school), idOf(redNotebooks)].sort()
    );
  });
});
