'use strict';

// The edges of the governance context the acceptance tests leave out: a company
// whose standard dimensions were never seeded, and an email whose list of company
// values holds an email type.

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
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const {
  buildGovernanceContext,
} = require('../../../packages/server/taxonomy/services/governance-context.service.js');

const itemLabelled = (label) =>
  models.TaxonomyItems.all().find((item) => item.label === label);

describe('governance context: the edges', () => {
  beforeEach(() => {
    resetTaxonomyModels(models);
    models.TaxonomyItems.seed([
      { _company: COMPANY_A, type: 'emailType', label: 'Promo' },
      { _company: COMPANY_A, type: 'emailType', label: 'Relance' },
    ]);
  });

  it('gives the standard dimensions in the doctrine’s words when the company never had them seeded', async () => {
    const context = await buildGovernanceContext({
      mailing: {
        _company: COMPANY_A,
        _emailType: itemLabelled('Promo')._id,
        trigger: 'adhoc',
      },
      lang: 'en',
    });

    expect(
      context.dimensions.map((dimension) => [
        dimension.label,
        dimension.value.label,
      ])
    ).toEqual([
      ['Email type', 'Promo'],
      ['Trigger', 'One Shot'],
    ]);
    expect(context.text).toContain('### Email type : Promo');
  });

  it('reads the email type from its own field only, never from the list of company values', async () => {
    const context = await buildGovernanceContext({
      mailing: {
        _company: COMPANY_A,
        _emailType: itemLabelled('Promo')._id,
        _taxonomyItems: [itemLabelled('Relance')._id],
      },
      lang: 'fr',
    });

    expect(JSON.stringify(context)).not.toContain('Relance');
    expect(context.dimensions[0].value.label).toBe('Promo');
  });

  it('reports the trigger as missing when the email has none', async () => {
    const context = await buildGovernanceContext({
      mailing: { _company: COMPANY_A },
      lang: 'fr',
    });

    expect(context.missing).toEqual(['emailType', 'trigger']);
  });
});
