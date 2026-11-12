'use strict';

// Acceptance tests of the taxonomy screen's dimension roles and normalised codes
// (epic #1501, ADR-0023): what the screen offers before the server refuses.

const HELPERS = '../../../packages/ui/helpers/taxonomy-roles.js';

const EMAIL_TYPE = { name: 'emailType', standard: true, isActive: true };
const TRIGGER = { name: 'trigger', standard: true, isActive: true };
const MARKET = { name: 'market', isActive: true, role: 'country' };
const LANGUAGE = { name: 'language', isActive: true, role: 'language' };
const BRAND = { name: 'brand', isActive: true };

// Turned on by #1503 (a dimension carries a role, its values a normalised code)
describe('taxonomy screen: roles and codes', () => {
  let roleOptions;
  let codeOptions;
  let valuesWithoutCode;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1503.
    ({ roleOptions, codeOptions, valuesWithoutCode } = require(HELPERS));
  });

  const ALL = [EMAIL_TYPE, TRIGGER, MARKET, LANGUAGE, BRAND];

  it('offers a dimension the roles no other dimension holds', () => {
    expect(roleOptions(ALL, BRAND)).toEqual(['locale']);
    expect(roleOptions([BRAND], BRAND)).toEqual([
      'language',
      'country',
      'locale',
    ]);
  });

  it('keeps offering a dimension the role it holds', () => {
    expect(roleOptions(ALL, LANGUAGE)).toEqual(['language', 'locale']);
  });

  it('counts a deactivated dimension as holding its role', () => {
    expect(
      roleOptions([{ ...LANGUAGE, isActive: false }, BRAND], BRAND)
    ).toEqual(['country', 'locale']);
  });

  it('offers no role to a standard dimension', () => {
    expect(roleOptions(ALL, EMAIL_TYPE)).toEqual([]);
    expect(roleOptions(ALL, TRIGGER)).toEqual([]);
  });

  it('names the language codes in the reader’s language', () => {
    const french = codeOptions('language', 'fr').find(
      (option) => option.value === 'fr'
    );
    const english = codeOptions('language', 'en').find(
      (option) => option.value === 'nl'
    );

    expect(french.text).toMatch(/français/i);
    expect(english.text).toMatch(/dutch/i);
  });

  it('offers every ISO 639-1 language and every country', () => {
    expect(codeOptions('language', 'fr').length).toBeGreaterThanOrEqual(180);
    expect(codeOptions('country', 'fr').length).toBeGreaterThanOrEqual(240);
    expect(
      codeOptions('country', 'fr').find((option) => option.value === 'BE').text
    ).toMatch(/belgique/i);
  });

  // A list of every language-country pair would hold tens of thousands of
  // entries: a locale is picked as a language and an optional country.
  it('edits a locale as a language and an optional country', () => {
    const { splitLocale, joinLocale } = require(HELPERS);

    expect(splitLocale('fr-BE')).toEqual({ language: 'fr', country: 'BE' });
    expect(splitLocale('nl')).toEqual({ language: 'nl', country: null });
    expect(splitLocale(null)).toEqual({ language: null, country: null });
    expect(joinLocale({ language: 'de', country: 'CH' })).toBe('de-CH');
    expect(joinLocale({ language: 'de', country: null })).toBe('de');
    expect(joinLocale({ language: null, country: 'CH' })).toBeNull();
  });

  it('counts the values of a dimension that lack a code', () => {
    expect(
      valuesWithoutCode([
        { label: 'Français', code: 'fr' },
        { label: 'Multilingue' },
        { label: 'Autre', code: '' },
      ])
    ).toBe(2);
  });
});
