'use strict';

// Acceptance tests of what the email's locale changes in the AI translation
// (epic #1501, ADR-0023): the source language it starts from, and the language
// value the translated copy carries.

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
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const TRANSLATION_LOCALE =
  '../../../packages/server/translation/translation-locale.js';

const declare = (payload) =>
  dimensionService.createDimension({ user: adminA, payload });
const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });

let belgium;
let canada;
let french;
let dutch;
let brandA;

async function givenLanguageUnderMarket() {
  await declare({ name: 'market', label: 'Marché', role: 'country' });
  await declare({
    name: 'language',
    label: 'Langue',
    role: 'language',
    parentName: 'market',
  });
  await declare({ name: 'brand', label: 'Marque' });
  belgium = await addValue('market', { label: 'Belgique', code: 'BE' });
  canada = await addValue('market', { label: 'Canada', code: 'CA' });
  french = await addValue('language', {
    label: 'Français',
    code: 'fr',
    parentIds: [idOf(belgium), idOf(canada)],
  });
  dutch = await addValue('language', {
    label: 'Néerlandais',
    code: 'nl',
    parentIds: [idOf(belgium)],
  });
  brandA = await addValue('brand', { label: 'Marque A' });
}

const email = (values = [], extra = {}) => ({
  _company: COMPANY_A,
  _taxonomyItems: values.map((value) => value._id),
  ...extra,
});

beforeEach(() => resetTaxonomyModels(models));

// Turned on by #1506 (the translation starts from the email's language)
describe.skip('translation source language from the email', () => {
  let sourceLanguageFor;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1506.
    ({ sourceLanguageFor } = require(TRANSLATION_LOCALE));
  });

  it("starts from the email's language, without detection", async () => {
    await givenLanguageUnderMarket();

    expect(
      await sourceLanguageFor({
        mailing: email([belgium, french], {
          previewHtml: '<html lang="en"><body></body></html>',
        }),
        requested: 'auto',
      })
    ).toBe('fr');
  });

  it('keeps detecting the language when the email has none', async () => {
    await givenLanguageUnderMarket();

    expect(
      await sourceLanguageFor({
        mailing: email([belgium], {
          previewHtml: '<html lang="de"><body></body></html>',
        }),
        requested: 'auto',
      })
    ).toBe('de');
    expect(
      await sourceLanguageFor({ mailing: email([belgium]), requested: 'auto' })
    ).toBe('auto');
  });

  it('lets a source language the user chose win', async () => {
    await givenLanguageUnderMarket();

    expect(
      await sourceLanguageFor({
        mailing: email([belgium, french]),
        requested: 'nl',
      })
    ).toBe('nl');
  });
});

// Turned on by #1507 (the translated copy carries the target language value)
describe.skip('translated copy: the language value follows', () => {
  let copyLanguageValues;

  beforeAll(() => {
    ({ copyLanguageValues } = require(TRANSLATION_LOCALE));
  });

  it('gives the copy the value of the target language, offered under the market', async () => {
    await givenLanguageUnderMarket();

    const { taxonomyItemIds, warning } = await copyLanguageValues({
      mailing: email([belgium, french, brandA]),
      targetLanguage: 'nl',
    });

    expect(idsOf(taxonomyItemIds).sort()).toEqual(
      [idOf(belgium), idOf(dutch), idOf(brandA)].sort()
    );
    expect(warning).toBeNull();
  });

  it('reads a regional target by its language: en-gb looks for en', async () => {
    await givenLanguageUnderMarket();
    const english = await addValue('language', {
      label: 'Anglais',
      code: 'en',
    });

    const { taxonomyItemIds } = await copyLanguageValues({
      mailing: email([canada, french]),
      targetLanguage: 'en-gb',
    });

    expect(idsOf(taxonomyItemIds).sort()).toEqual(
      [idOf(canada), idOf(english)].sort()
    );
  });

  it('carries no language when none is offered under the market, and says so', async () => {
    await givenLanguageUnderMarket();

    const { taxonomyItemIds, warning } = await copyLanguageValues({
      mailing: email([canada, french]),
      targetLanguage: 'nl',
    });

    expect(idsOf(taxonomyItemIds)).toEqual([idOf(canada)]);
    expect(warning).toBe('TRANSLATION_LANGUAGE_VALUE_NOT_FOUND');
  });

  it('carries no language when two values match, and says so', async () => {
    await givenLanguageUnderMarket();
    await addValue('language', {
      label: 'Néerlandais simplifié',
      code: 'nl',
      parentIds: [idOf(belgium)],
    });

    const { taxonomyItemIds, warning } = await copyLanguageValues({
      mailing: email([belgium, french]),
      targetLanguage: 'nl',
    });

    expect(idsOf(taxonomyItemIds)).toEqual([idOf(belgium)]);
    expect(warning).toBe('TRANSLATION_LANGUAGE_VALUE_AMBIGUOUS');
  });

  it('follows a locale role with the current country', async () => {
    await declare({
      name: 'marketLanguage',
      label: 'Marché-langue',
      role: 'locale',
    });
    const belgianFrench = await addValue('marketLanguage', {
      label: 'Belgique — français',
      code: 'fr-BE',
    });
    const belgianDutch = await addValue('marketLanguage', {
      label: 'Belgique — néerlandais',
      code: 'nl-BE',
    });
    await addValue('marketLanguage', {
      label: 'Pays-Bas — néerlandais',
      code: 'nl-NL',
    });

    const { taxonomyItemIds, warning } = await copyLanguageValues({
      mailing: email([belgianFrench]),
      targetLanguage: 'nl',
    });

    expect(idsOf(taxonomyItemIds)).toEqual([idOf(belgianDutch)]);
    expect(warning).toBeNull();
  });

  it('leaves the values alone for a company with no language role', async () => {
    await declare({ name: 'brand', label: 'Marque' });
    const brand = await addValue('brand', { label: 'Marque A' });

    const { taxonomyItemIds, warning } = await copyLanguageValues({
      mailing: email([brand]),
      targetLanguage: 'nl',
    });

    expect(idsOf(taxonomyItemIds)).toEqual([idOf(brand)]);
    expect(warning).toBeNull();
  });

  it('never touches the source email', async () => {
    await givenLanguageUnderMarket();
    const source = email([belgium, french]);
    const before = idsOf(source._taxonomyItems);

    await copyLanguageValues({ mailing: source, targetLanguage: 'nl' });

    expect(idsOf(source._taxonomyItems)).toEqual(before);
  });
});
