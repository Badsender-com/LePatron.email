'use strict';

// An email type value (epic #1631, ADR-0030): an identifier like any value,
// which a template compares, and a doctrine type of its own, which maps it onto
// one of the six types of the Badsender classification doctrine. The two are
// independent: two email types may share a doctrine type, never an identifier.

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
  techAdminA,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: techAdminA, type, payload });
const editValue = (value, payload) =>
  taxonomyService.updateTaxonomyItem({
    user: techAdminA,
    itemId: idOf(value),
    payload,
  });
const stored = (value) =>
  models.TaxonomyItems.all().find((item) => idOf(item) === idOf(value));

beforeEach(() => {
  resetTaxonomyModels(models);
  models.Templates.reset();
});

// Turned on by #1633 (the doctrine type of an email type is a field of its own)
describe('email type value: doctrine type', () => {
  it('stores the doctrine type an email type is mapped onto', async () => {
    const value = await addValue('emailType', {
      label: 'Infolettre communauté',
      doctrineType: 'editorial',
    });

    expect(stored(value).doctrineType).toBe('editorial');
  });

  it('accepts an email type mapped onto nothing', async () => {
    const value = await addValue('emailType', { label: 'Enquête' });

    expect(stored(value).doctrineType || null).toBeNull();
  });

  it('lets two email types share a doctrine type', async () => {
    await addValue('emailType', {
      label: 'Infolettre communauté',
      doctrineType: 'editorial',
    });

    await expect(
      addValue('emailType', {
        label: 'Relationnel',
        doctrineType: 'editorial',
      })
    ).resolves.toBeTruthy();
  });

  it('refuses a doctrine type outside the six of the doctrine', async () => {
    await expect(
      addValue('emailType', { label: 'Infolettre', doctrineType: 'newsletter' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('refuses a doctrine type on a value of another dimension', async () => {
    await dimensionService.createDimension({
      user: techAdminA,
      payload: { name: 'market', label: 'Marché' },
    });

    await expect(
      addValue('market', { label: 'Belgique', doctrineType: 'editorial' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('changes or clears the doctrine type without touching the identifier', async () => {
    const value = await addValue('emailType', {
      label: 'Infolettre communauté',
      canonicalType: 'com',
      doctrineType: 'editorial',
    });

    await editValue(value, { doctrineType: 'promotional' });
    expect(stored(value).doctrineType).toBe('promotional');

    await editValue(value, { doctrineType: null });
    expect(stored(value).doctrineType || null).toBeNull();
    expect(stored(value).canonicalType).toBe('com');
  });
});

// Turned on by #1638 (an email type has a free identifier, like any value)
describe.skip('email type value: identifier', () => {
  it('keeps the identifier an admin gives an email type', async () => {
    const value = await addValue('emailType', {
      label: 'Infolettre communauté',
      canonicalType: 'com',
      doctrineType: 'editorial',
    });

    expect(stored(value).canonicalType).toBe('com');
    expect(stored(value).doctrineType).toBe('editorial');
  });

  it('refuses an identifier a template could not compare', async () => {
    await expect(
      addValue('emailType', {
        label: 'Infolettre',
        canonicalType: 'infolettre é',
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('refuses two email types the same identifier, even under two doctrine types', async () => {
    await addValue('emailType', {
      label: 'Infolettre communauté',
      canonicalType: 'com',
      doctrineType: 'editorial',
    });

    await expect(
      addValue('emailType', {
        label: 'Communication commerciale',
        canonicalType: 'com',
        doctrineType: 'promotional',
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_IDENTIFIER_ALREADY_EXISTS,
    });
  });

  it('asks for a confirmation before changing the identifier of an email type an email carries', async () => {
    const value = await addValue('emailType', {
      label: 'Infolettre communauté',
      canonicalType: 'com',
    });
    models.Mailings.seed([
      {
        _id: '507f1f77bcf86cd799439c01',
        _company: techAdminA.group.id,
        _emailType: idOf(value),
      },
    ]);

    await expect(
      editValue(value, { canonicalType: 'communaute' })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_IDENTIFIER_CHANGE_UNCONFIRMED,
    });
    await editValue(value, {
      canonicalType: 'communaute',
      confirmIdentifierChange: true,
    });
    expect(stored(value).canonicalType).toBe('communaute');
  });
});

// Turned on by #1636 (the template receives the doctrine type as doctrineType)
describe('doctrineType is a reserved name', () => {
  it('refuses a company dimension named doctrineType', async () => {
    await expect(
      dimensionService.createDimension({
        user: techAdminA,
        payload: { name: 'doctrineType', label: 'Type' },
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});
