'use strict';

// Where a template's contract comes from (#1520, ADR-0024): read from the markup
// each time a template is saved with new markup, and read on first need for a
// template saved before the contract existed.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);

const models = require('../../../packages/server/common/models.common.js');
const { COMPANY_A } = require('../../helpers/taxonomy-world.js');
const {
  TEMPLATE_READING_SILO_AND_BRAND,
  TEMPLATE_READING_MARKET,
} = require('./template-contract.fixtures.js');
const {
  contractOfTemplate,
} = require('../../../packages/server/template/template-contract.service.js');
const {
  refreshContract,
} = require('../../../packages/server/template/template-contract.js');

const TEMPLATE = '507f1f77bcf86cd799439f01';

beforeEach(() => models.Templates.reset());

describe('the contract of a template saved before it existed', () => {
  it('is read from the markup on first need', async () => {
    models.Templates.seed([
      { _id: TEMPLATE, _company: COMPANY_A, markup: TEMPLATE_READING_MARKET },
    ]);

    expect(await contractOfTemplate(TEMPLATE)).toEqual({
      declared: { market: '' },
      read: ['market'],
      adopt: {},
    });
  });

  it('is kept once read, so the markup is read once', async () => {
    models.Templates.seed([
      { _id: TEMPLATE, _company: COMPANY_A, markup: TEMPLATE_READING_MARKET },
    ]);
    await contractOfTemplate(TEMPLATE);
    // Changed behind the template's back, without a save: the contract kept is
    // the one read the first time.
    await models.Templates.updateOne(
      { _id: TEMPLATE },
      { $set: { markup: TEMPLATE_READING_SILO_AND_BRAND } }
    );

    expect((await contractOfTemplate(TEMPLATE)).read).toEqual(['market']);
  });

  it('is empty for a template that does not exist, or has no markup', async () => {
    models.Templates.seed([{ _id: TEMPLATE, _company: COMPANY_A }]);
    const empty = { declared: {}, read: [], adopt: {} };

    expect(await contractOfTemplate(TEMPLATE)).toEqual(empty);
    expect(await contractOfTemplate('507f1f77bcf86cd799439f09')).toEqual(empty);
    expect(await contractOfTemplate(null)).toEqual(empty);
  });
});

describe('the contract of a template being saved', () => {
  const documentOf = ({ isNew = false, modified = [], ...fields }) => ({
    ...fields,
    isNew,
    isModified: (path) => modified.includes(path),
    markModified: jest.fn(),
  });

  it('is read when the template is created', () => {
    const template = documentOf({
      isNew: true,
      markup: TEMPLATE_READING_MARKET,
    });

    refreshContract(template);

    expect(template.contract.read).toEqual(['market']);
    expect(template.markModified).toHaveBeenCalledWith('contract');
  });

  it('is read again when new markup is uploaded', () => {
    const template = documentOf({
      modified: ['markup'],
      markup: TEMPLATE_READING_SILO_AND_BRAND,
      contract: { declared: { market: '' }, read: ['market'], adopt: {} },
    });

    refreshContract(template);

    expect(template.contract.adopt).toEqual({ siloBrand: 'brand_[silo]' });
  });

  it('is left alone when the save changes something else', () => {
    const kept = { declared: { market: '' }, read: ['market'], adopt: {} };
    const template = documentOf({
      modified: ['name'],
      markup: TEMPLATE_READING_SILO_AND_BRAND,
      contract: kept,
    });

    refreshContract(template);

    expect(template.contract).toBe(kept);
    expect(template.markModified).not.toHaveBeenCalled();
  });
});
