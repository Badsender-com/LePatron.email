'use strict';

// Acceptance tests of the locale the editor publishes to a template (epic
// #1501, ADR-0023): under `locale`, computed from the values chosen in the email
// settings with the rule the server applies, so a template writes its
// `<html lang>` from it.

const MARKET = {
  name: 'market',
  role: 'country',
  values: [
    { id: 'be', canonicalType: 'be', code: 'BE' },
    { id: 'ca', canonicalType: 'ca', code: 'CA' },
  ],
};

const LANGUAGE = {
  name: 'language',
  role: 'language',
  parentName: 'market',
  values: [
    { id: 'fr', canonicalType: 'fr', code: 'fr' },
    { id: 'multi', canonicalType: 'multi' },
  ],
};

const MARKET_LANGUAGE = {
  name: 'marketLanguage',
  role: 'locale',
  values: [{ id: 'ch_de', canonicalType: 'ch_de', code: 'de-CH' }],
};

// Turned on by #1505 (the template receives the locale)
describe.skip('publishing the locale to the template', () => {
  let governanceValues;

  beforeAll(() => {
    ({
      governanceValues,
    } = require('../../packages/editor/src/js/utils/governance-values.js'));
  });

  const localeOf = (dimensions, selections) =>
    governanceValues({ dimensions, selections }).values.locale;

  it('publishes the locale of the values chosen', () => {
    expect(localeOf([MARKET, LANGUAGE], { market: 'be', language: 'fr' })).toBe(
      'fr-BE'
    );
    expect(localeOf([MARKET, LANGUAGE], { language: 'fr' })).toBe('fr');
  });

  it('follows a change of market, live', () => {
    expect(localeOf([MARKET, LANGUAGE], { market: 'ca', language: 'fr' })).toBe(
      'fr-CA'
    );
  });

  it('lets a dimension with the locale role decide alone', () => {
    expect(
      localeOf([MARKET, LANGUAGE, MARKET_LANGUAGE], {
        market: 'be',
        language: 'fr',
        marketLanguage: 'ch_de',
      })
    ).toBe('de-CH');
  });

  it('publishes an empty locale when the language is unknown', () => {
    expect(
      localeOf([MARKET, LANGUAGE], { market: 'be', language: 'multi' })
    ).toBe('');
    expect(localeOf([], {})).toBe('');
  });

  it('reads no locale from a deactivated dimension', () => {
    expect(
      localeOf([MARKET, { ...LANGUAGE, isActive: false }], {
        market: 'be',
        language: 'fr',
      })
    ).toBe('');
  });

  it('keeps publishing each dimension under its own name', () => {
    const { values } = governanceValues({
      dimensions: [MARKET, LANGUAGE],
      selections: { market: 'be', language: 'fr' },
    });

    expect(values).toMatchObject({ market: 'be', language: 'fr' });
  });
});
