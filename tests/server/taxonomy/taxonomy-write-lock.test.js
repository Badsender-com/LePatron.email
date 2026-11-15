'use strict';

// One write at a time on a dimension (review of epic #1547, ADR-0026). The
// crossings, the order of the values and the precedence are checked against
// what is stored, then written value by value: two saves running together
// could each pass and leave two defaults under one parent value. The second
// one is refused, never queued, and the admin saves again.

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
  COMPANY_A,
  techAdminA,
  idOf,
  idsOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const declare = (payload) =>
  dimensionService.createDimension({ user: techAdminA, payload });
const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: techAdminA, type, payload });
const save = (crossings) =>
  taxonomyService.saveCrossings({
    user: techAdminA,
    type: 'language',
    crossings,
  });

let belgium;
let french;
let dutch;

const defaultUnderBelgium = (value) =>
  [
    { itemId: idOf(french), parentIds: [], defaultUnder: [] },
    { itemId: idOf(dutch), parentIds: [], defaultUnder: [] },
  ].map((entry) =>
    entry.itemId === idOf(value)
      ? { ...entry, defaultUnder: [idOf(belgium)] }
      : entry
  );

async function defaultsUnderBelgium() {
  const values = await taxonomyService.listTaxonomyItems({
    user: techAdminA,
    type: 'language',
  });
  return values
    .filter((value) => idsOf(value.defaultUnder).includes(idOf(belgium)))
    .map((value) => value.label);
}

const holdLanguage = (until) =>
  models.TaxonomyDimensions.updateOne(
    { _company: COMPANY_A, name: 'language' },
    { $set: { writeLockUntil: until, writeLockToken: 'another-write' } }
  );

beforeEach(async () => {
  resetTaxonomyModels(models);
  await declare({ name: 'market', label: 'Marché' });
  await declare({ name: 'language', label: 'Langue', parentName: 'market' });
  belgium = await addValue('market', { label: 'Belgique' });
  french = await addValue('language', { label: 'Français' });
  dutch = await addValue('language', { label: 'Néerlandais' });
});

describe('one write at a time on a dimension', () => {
  it('keeps one default under a parent value when two matrices are saved at once', async () => {
    const results = await Promise.allSettled([
      save(defaultUnderBelgium(french)),
      save(defaultUnderBelgium(dutch)),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(
      results.find((result) => result.status === 'rejected').reason
    ).toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_WRITE_IN_PROGRESS,
    });
    expect(await defaultsUnderBelgium()).toHaveLength(1);
  });

  it('refuses a matrix while another write holds the dimension, writing nothing', async () => {
    await holdLanguage(new Date(Date.now() + 10000));

    await expect(save(defaultUnderBelgium(french))).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_WRITE_IN_PROGRESS,
    });
    expect(await defaultsUnderBelgium()).toEqual([]);
  });

  it('refuses a value marked default there meanwhile', async () => {
    await holdLanguage(new Date(Date.now() + 10000));

    await expect(
      taxonomyService.updateTaxonomyItem({
        user: techAdminA,
        itemId: idOf(dutch),
        payload: { defaultUnder: [idOf(belgium)] },
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.TAXONOMY_WRITE_IN_PROGRESS,
    });
  });

  it('still renames a value meanwhile: its label crosses nothing', async () => {
    await holdLanguage(new Date(Date.now() + 10000));

    await expect(
      taxonomyService.updateTaxonomyItem({
        user: techAdminA,
        itemId: idOf(dutch),
        payload: { label: 'Flamand' },
      })
    ).resolves.toMatchObject({ label: 'Flamand' });
  });

  it('takes over a claim that lapsed, left by a write that never ended', async () => {
    await holdLanguage(new Date(Date.now() - 1000));

    await save(defaultUnderBelgium(french));

    expect(await defaultsUnderBelgium()).toEqual(['Français']);
  });

  it('frees the dimension after a write, and after a refused one', async () => {
    await expect(
      save([{ itemId: idOf(french), parentIds: [], defaultUnder: [] }])
    ).rejects.toMatchObject({ status: 400 });

    await save(defaultUnderBelgium(french));
    await save(defaultUnderBelgium(dutch));

    expect(await defaultsUnderBelgium()).toEqual(['Néerlandais']);
  });

  it('refuses a drop of the values while their dimension is held', async () => {
    await holdLanguage(new Date(Date.now() + 10000));

    await expect(
      taxonomyService.reorderValues({
        user: techAdminA,
        type: 'language',
        itemIds: [idOf(dutch), idOf(french)],
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.TAXONOMY_WRITE_IN_PROGRESS,
    });
  });

  it('refuses the precedence while one dimension is held', async () => {
    await holdLanguage(new Date(Date.now() + 10000));

    await expect(
      dimensionService.setPrecedence({
        user: techAdminA,
        names: ['market', 'language'],
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.TAXONOMY_WRITE_IN_PROGRESS,
    });
  });

  it('still refuses an unknown dimension as a bad request, not as held', async () => {
    await expect(
      dimensionService.reorderDimensions({
        user: techAdminA,
        names: ['market', 'season'],
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });
});
