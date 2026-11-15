'use strict';

// The crossings of a child dimension (epic #1547, ADR-0026): for each of its
// values, the parent values it is offered under (its availability) and the ones
// it is the default under (ADR-0024). Edited as one matrix, saved by one request
// that replaces them all, or refuses them all: availability and defaults have to
// agree, and a cell-by-cell save would pass through states the server refuses.
//
// An empty availability still reads "offered everywhere, future values
// included" (ADR-0032).

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
  adminB,
  techAdminA,
  idOf,
  idsOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const declare = (payload, user = techAdminA) =>
  dimensionService.createDimension({ user, payload });

const addValue = (type, payload, user = techAdminA) =>
  taxonomyService.createTaxonomyItem({ user, type, payload });

const save = (type, crossings) =>
  taxonomyService.saveCrossings({ user: techAdminA, type, crossings });

let belgium;
let switzerland;
let canada;
let french;
let dutch;
let english;

// What each language is offered under and default under, by label.
async function crossingsOf(type) {
  const values = await taxonomyService.listTaxonomyItems({
    user: techAdminA,
    type,
  });
  return Object.fromEntries(
    values.map((value) => [
      value.label,
      {
        parents: idsOf(value._parents),
        defaultUnder: idsOf(value.defaultUnder),
      },
    ])
  );
}

beforeEach(async () => {
  resetTaxonomyModels(models);
  await declare({ name: 'market', label: 'Marché' });
  await declare({ name: 'language', label: 'Langue', parentName: 'market' });
  belgium = await addValue('market', {
    label: 'Belgique',
    canonicalType: 'be',
  });
  switzerland = await addValue('market', {
    label: 'Suisse',
    canonicalType: 'ch',
  });
  canada = await addValue('market', { label: 'Canada', canonicalType: 'ca' });
  french = await addValue('language', {
    label: 'Français',
    canonicalType: 'fr',
  });
  dutch = await addValue('language', {
    label: 'Néerlandais',
    canonicalType: 'nl',
    parentIds: [idOf(belgium)],
  });
  english = await addValue('language', {
    label: 'Anglais',
    canonicalType: 'en',
    parentIds: [idOf(canada)],
  });
});

describe('bulk crossings', () => {
  const B = () => idOf(belgium);
  const CH = () => idOf(switzerland);
  const CA = () => idOf(canada);

  it('saves the availability and the defaults of every value together', async () => {
    await save('language', [
      {
        itemId: idOf(french),
        parentIds: [B(), CH(), CA()],
        defaultUnder: [B(), CH()],
      },
      { itemId: idOf(dutch), parentIds: [B()], defaultUnder: [] },
      { itemId: idOf(english), parentIds: [CA()], defaultUnder: [CA()] },
    ]);

    expect(await crossingsOf('language')).toEqual({
      Français: { parents: [B(), CH(), CA()], defaultUnder: [B(), CH()] },
      Néerlandais: { parents: [B()], defaultUnder: [] },
      Anglais: { parents: [CA()], defaultUnder: [CA()] },
    });
  });

  it('keeps an empty availability as offered everywhere, a default allowed under any parent value', async () => {
    await save('language', [
      { itemId: idOf(french), parentIds: [], defaultUnder: [B()] },
      { itemId: idOf(dutch), parentIds: [B()], defaultUnder: [] },
      { itemId: idOf(english), parentIds: [], defaultUnder: [CA()] },
    ]);

    expect(await crossingsOf('language')).toEqual({
      Français: { parents: [], defaultUnder: [B()] },
      Néerlandais: { parents: [B()], defaultUnder: [] },
      Anglais: { parents: [], defaultUnder: [CA()] },
    });
  });

  // Each refusal leaves every value as it was: nothing half saved.
  const unchanged = () => ({
    Français: { parents: [], defaultUnder: [] },
    Néerlandais: { parents: [B()], defaultUnder: [] },
    Anglais: { parents: [CA()], defaultUnder: [] },
  });

  it('refuses them all when a value is the default under a parent value it is not offered under', async () => {
    await expect(
      save('language', [
        { itemId: idOf(french), parentIds: [B()], defaultUnder: [B()] },
        { itemId: idOf(dutch), parentIds: [B()], defaultUnder: [] },
        { itemId: idOf(english), parentIds: [CA()], defaultUnder: [B()] },
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.TAXONOMY_DEFAULT_UNDER_NOT_OFFERED,
    });

    expect(await crossingsOf('language')).toEqual(unchanged());
  });

  it('refuses them all when two values are the default under one parent value', async () => {
    await expect(
      save('language', [
        { itemId: idOf(french), parentIds: [], defaultUnder: [B()] },
        { itemId: idOf(dutch), parentIds: [B()], defaultUnder: [B()] },
        { itemId: idOf(english), parentIds: [CA()], defaultUnder: [] },
      ])
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_DEFAULT_TAKEN,
    });

    expect(await crossingsOf('language')).toEqual(unchanged());
  });

  it('refuses them all when a value of the dimension is left out', async () => {
    await expect(
      save('language', [
        { itemId: idOf(french), parentIds: [B()], defaultUnder: [] },
        { itemId: idOf(dutch), parentIds: [B()], defaultUnder: [] },
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });

    expect(await crossingsOf('language')).toEqual(unchanged());
  });

  it('refuses a parent value that is not a value of the parent dimension', async () => {
    await expect(
      save('language', [
        { itemId: idOf(french), parentIds: [idOf(dutch)], defaultUnder: [] },
        { itemId: idOf(dutch), parentIds: [B()], defaultUnder: [] },
        { itemId: idOf(english), parentIds: [CA()], defaultUnder: [] },
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it("refuses another company's parent value", async () => {
    await declare({ name: 'market', label: 'Market' }, adminB);
    const elsewhere = await addValue('market', { label: 'Spain' }, adminB);

    await expect(
      save('language', [
        {
          itemId: idOf(french),
          parentIds: [idOf(elsewhere)],
          defaultUnder: [],
        },
        { itemId: idOf(dutch), parentIds: [B()], defaultUnder: [] },
        { itemId: idOf(english), parentIds: [CA()], defaultUnder: [] },
      ])
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses crossings on a first-level dimension, which has no parent', async () => {
    await expect(
      save('market', [
        { itemId: idOf(belgium), parentIds: [], defaultUnder: [] },
        { itemId: idOf(switzerland), parentIds: [], defaultUnder: [] },
        { itemId: idOf(canada), parentIds: [], defaultUnder: [] },
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });
});
