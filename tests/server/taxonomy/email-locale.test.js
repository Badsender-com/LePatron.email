'use strict';

// Acceptance tests of the locale of an email (epic #1501, ADR-0023).
//
// Computed at read time from the values the email carries: a dimension with the
// `locale` role decides alone; otherwise the `language` and `country` values
// compose (`fr` + `BE` → `fr-BE`). Nothing is guessed: a missing part is null.

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
  COMPANY_B,
  adminA,
  adminB,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const declare = (payload, user = adminA) =>
  dimensionService.createDimension({ user, payload });
const addValue = (type, payload, user = adminA) =>
  taxonomyService.createTaxonomyItem({ user, type, payload });
const dimensionNamed = async (name) =>
  (await dimensionService.listDimensions({ user: adminA })).find(
    (dimension) => dimension.name === name
  );

let belgium;
let french;
let dutch;
let multilingual;

async function givenLanguageAndMarket() {
  await declare({ name: 'market', label: 'Marché', role: 'country' });
  await declare({
    name: 'language',
    label: 'Langue',
    role: 'language',
    parentName: 'market',
  });
  belgium = await addValue('market', { label: 'Belgique', code: 'BE' });
  french = await addValue('language', { label: 'Français', code: 'fr' });
  dutch = await addValue('language', { label: 'Néerlandais', code: 'nl' });
  multilingual = await addValue('language', { label: 'Multilingue' });
}

const email = (values = [], extra = {}) => ({
  _company: COMPANY_A,
  _taxonomyItems: values.map((value) => value._id),
  ...extra,
});

beforeEach(() => resetTaxonomyModels(models));

// Turned on by #1504 (an email knows its locale, and the AI context says it)
describe('email locale', () => {
  let resolveEmailLocale;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1504.
    ({
      resolveEmailLocale,
    } = require('../../../packages/server/taxonomy/services/email-locale.service.js'));
  });

  it('composes the language and the country: Belgique + Français gives fr-BE', async () => {
    await givenLanguageAndMarket();

    expect(
      await resolveEmailLocale({ mailing: email([belgium, french]) })
    ).toEqual({ language: 'fr', country: 'BE', locale: 'fr-BE' });
  });

  it('gives the language alone when the email has no country', async () => {
    await givenLanguageAndMarket();

    expect(await resolveEmailLocale({ mailing: email([french]) })).toEqual({
      language: 'fr',
      country: null,
      locale: 'fr',
    });
  });

  it('knows the country without a language, and no locale', async () => {
    await givenLanguageAndMarket();

    expect(await resolveEmailLocale({ mailing: email([belgium]) })).toEqual({
      language: null,
      country: 'BE',
      locale: null,
    });
  });

  it('lets a dimension with the locale role decide alone', async () => {
    await givenLanguageAndMarket();
    await declare({
      name: 'marketLanguage',
      label: 'Marché-langue',
      role: 'locale',
    });
    const swissGerman = await addValue('marketLanguage', {
      label: 'Suisse — allemand',
      code: 'de-CH',
    });

    expect(
      await resolveEmailLocale({
        mailing: email([belgium, french, swissGerman]),
      })
    ).toEqual({ language: 'de', country: 'CH', locale: 'de-CH' });
  });

  it('guesses nothing for a value with no code', async () => {
    await givenLanguageAndMarket();

    expect(
      await resolveEmailLocale({ mailing: email([belgium, multilingual]) })
    ).toEqual({ language: null, country: 'BE', locale: null });
  });

  it('knows nothing of an email with no value, or of a company with no role', async () => {
    await declare({ name: 'audience', label: 'Cible' });
    const vip = await addValue('audience', { label: 'Clients VIP' });

    expect(await resolveEmailLocale({ mailing: email([vip]) })).toEqual({
      language: null,
      country: null,
      locale: null,
    });
    expect(await resolveEmailLocale({ mailing: email() })).toEqual({
      language: null,
      country: null,
      locale: null,
    });
  });

  it('reads no language from a deactivated dimension', async () => {
    await givenLanguageAndMarket();
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(await dimensionNamed('language')),
      payload: { isActive: false },
    });

    expect(
      await resolveEmailLocale({ mailing: email([belgium, french]) })
    ).toEqual({ language: null, country: 'BE', locale: null });
  });

  it('still reads a value deactivated since the email chose it', async () => {
    await givenLanguageAndMarket();
    await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(dutch),
      payload: { isActive: false },
    });

    expect(
      await resolveEmailLocale({ mailing: email([belgium, dutch]) })
    ).toMatchObject({ locale: 'nl-BE' });
  });

  it('reads no code from a dimension whose role was taken back', async () => {
    await givenLanguageAndMarket();
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(await dimensionNamed('market')),
      payload: { role: null },
    });

    expect(
      await resolveEmailLocale({ mailing: email([belgium, french]) })
    ).toEqual({ language: 'fr', country: null, locale: 'fr' });
  });

  it('never reads a value of another company the email would point at', async () => {
    await givenLanguageAndMarket();
    await declare(
      { name: 'language', label: 'Langue', role: 'language' },
      adminB
    );
    const elsewhere = await addValue(
      'language',
      { label: 'Allemand', code: 'de' },
      adminB
    );

    expect(
      await resolveEmailLocale({
        mailing: { _company: COMPANY_A, _taxonomyItems: [elsewhere._id] },
      })
    ).toEqual({ language: null, country: null, locale: null });
    expect(COMPANY_B).not.toBe(COMPANY_A);
  });
});

// Turned on by #1504 (an email knows its locale, and the AI context says it)
describe('governance context: the language of an email', () => {
  let buildGovernanceContext;

  beforeAll(() => {
    ({
      buildGovernanceContext,
    } = require('../../../packages/server/taxonomy/services/governance-context.service.js'));
  });

  it('states the language and the locale of the email', async () => {
    await givenLanguageAndMarket();

    const context = await buildGovernanceContext({
      mailing: email([belgium, french]),
      lang: 'fr',
    });

    expect(context).toMatchObject({ language: 'fr', locale: 'fr-BE' });
    expect(context.text).toContain("Langue de l'email : fr-BE");
  });

  it('says the language is unknown when the company has a role and the email no code', async () => {
    await givenLanguageAndMarket();

    const context = await buildGovernanceContext({
      mailing: email([belgium, multilingual]),
      lang: 'en',
    });

    expect(context).toMatchObject({ language: null, locale: null });
    expect(context.text).toContain('Email language: unknown');
  });

  it('says nothing of a language to a company with no role', async () => {
    const context = await buildGovernanceContext({
      mailing: email(),
      lang: 'fr',
    });

    expect(context.text).toBe('');
    expect(context.locale).toBeNull();
  });
});
