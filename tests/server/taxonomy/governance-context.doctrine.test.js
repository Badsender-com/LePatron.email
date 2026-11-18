'use strict';

// What the AI reads of an email's type (epic #1631, ADR-0030): its identifier,
// the company's own name for it, and its doctrine type, the vocabulary the
// expertises are written against.

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

const COMMUNITY = '507f1f77bcf86cd799439e01';
const SURVEY = '507f1f77bcf86cd799439e02';

beforeEach(() => {
  resetTaxonomyModels(models);
  models.TaxonomyItems.seed([
    {
      _id: COMMUNITY,
      _company: COMPANY_A,
      type: 'emailType',
      label: 'Infolettre communauté',
      canonicalType: 'com',
      doctrineType: 'editorial',
      description: 'Les nouvelles de la communauté.',
    },
    {
      _id: SURVEY,
      _company: COMPANY_A,
      type: 'emailType',
      label: 'Enquête',
      canonicalType: 'enq',
      doctrineType: null,
    },
  ]);
});

const contextOf = (emailTypeId) =>
  buildGovernanceContext({
    mailing: { _company: COMPANY_A, _emailType: emailTypeId },
    lang: 'fr',
  });

// Turned on by #1634 (the AI reads the doctrine type of an email type)
describe('governance context: identifier and doctrine type of the email type', () => {
  it('gives the identifier and the doctrine type of the email type, apart', async () => {
    const context = await contextOf(COMMUNITY);

    expect(context.dimensions[0]).toMatchObject({
      name: 'emailType',
      value: {
        label: 'Infolettre communauté',
        identifier: 'com',
        doctrineType: 'editorial',
        description: 'Les nouvelles de la communauté.',
      },
    });
    expect(context.text).toContain('editorial');
  });

  it('says nothing of a doctrine type the email type is mapped onto none', async () => {
    const context = await contextOf(SURVEY);

    expect(context.dimensions[0].value).toMatchObject({
      identifier: 'enq',
      doctrineType: null,
    });
  });
});

// Turned on by #1634 (the AI reads the doctrine type of an email type)
describe('expertises filtered by the doctrine type', () => {
  it('gives the doctrine type of the email, the type the expertises are filtered by', async () => {
    expect((await contextOf(COMMUNITY)).doctrineType).toBe('editorial');
  });

  it('gives no doctrine type for an email whose type is mapped onto nothing, or which has no type', async () => {
    expect((await contextOf(SURVEY)).doctrineType).toBeNull();
    expect((await contextOf(null)).doctrineType).toBeNull();
  });
});
