'use strict';

// The state of the dimension selects of the email settings, moved out of the
// editor plugin by #1519 so that it is tested: what the section opens with, what
// a change leaves, and what the template reads.

const {
  initialSelections,
  openingSelections,
  nextSelections,
  templateValuesFor,
} = require('../../packages/editor/src/js/utils/dimension-state.js');
const {
  unloadGuardFor,
} = require('../../packages/editor/src/js/utils/email-metadata-store.js');
const {
  translatedTriggerOptions,
} = require('../../packages/editor/src/js/utils/email-metadata-options.js');

const MARKET = {
  name: 'market',
  values: [
    { id: 'ca', canonicalType: 'ca', isActive: true },
    { id: 'be', canonicalType: 'be', isActive: true },
  ],
};
const LANGUAGE = {
  name: 'language',
  parentName: 'market',
  values: [
    { id: 'fr', canonicalType: 'fr', isActive: true, parentIds: ['ca', 'be'] },
    { id: 'nl', canonicalType: 'nl', isActive: true, parentIds: ['be'] },
    { id: 'en', canonicalType: 'en', isActive: true, parentIds: ['ca'] },
  ],
};

describe('the state of the dimension selects', () => {
  it('opens with one key per dimension, empty when the email has no value', () => {
    expect(initialSelections([MARKET, LANGUAGE], ['be'])).toEqual({
      market: 'be',
      language: '',
    });
  });

  it('empties, rather than removes, a value no longer offered', () => {
    expect(
      nextSelections({
        dimensions: [MARKET, LANGUAGE],
        selections: { market: 'ca', language: 'nl' },
        changed: ['market'],
      })
    ).toEqual({ market: 'ca', language: '' });
  });

  it('lands a child on the default of the new parent value (#1524)', () => {
    const withDefault = {
      ...LANGUAGE,
      values: LANGUAGE.values.map((value) =>
        value.id === 'en' ? { ...value, defaultUnder: ['ca'] } : value
      ),
    };

    expect(
      nextSelections({
        dimensions: [MARKET, withDefault],
        selections: { market: 'ca', language: 'nl' },
        changed: ['market'],
      })
    ).toEqual({ market: 'ca', language: 'en' });
  });

  it('lands a child on the only value the new parent value offers (#1524)', () => {
    expect(
      nextSelections({
        dimensions: [
          MARKET,
          { ...LANGUAGE, values: LANGUAGE.values.slice(0, 2) },
        ],
        selections: { market: 'ca', language: 'nl' },
        changed: ['market'],
      })
    ).toEqual({ market: 'ca', language: 'fr' });
  });

  it('lands a child of the email type on its default (#1524)', () => {
    const season = {
      name: 'season',
      parentName: 'emailType',
      values: [
        { id: 'spring', isActive: true, parentIds: ['t1'] },
        { id: 'fall', isActive: true, parentIds: ['t1'], defaultUnder: ['t1'] },
      ],
    };

    expect(
      nextSelections({
        dimensions: [season],
        selections: { season: '' },
        emailTypeId: 't1',
        changed: ['emailType'],
      })
    ).toEqual({ season: 'fall' });
  });

  it('publishes the email type with the dimensions', () => {
    expect(
      templateValuesFor({
        emailTypes: [{ id: 't1', canonicalType: 'newsletter' }],
        dimensions: [MARKET],
        selections: { market: 'be' },
        emailTypeId: 't1',
        trigger: 'manual',
      })
    ).toMatchObject({
      emailType: 'newsletter',
      market: 'be',
      trigger: 'manual',
    });
  });
});

describe('the prompt on the way out', () => {
  const event = () => ({ preventDefault: jest.fn() });

  it('says nothing while the metadata are not dirty', () => {
    const guard = unloadGuardFor({ isDirty: () => false });
    const leaving = event();

    expect(guard(leaving)).toBeUndefined();
    expect(leaving.preventDefault).not.toHaveBeenCalled();
  });

  it('asks before leaving dirty metadata', () => {
    const guard = unloadGuardFor({ isDirty: () => true });
    const leaving = event();

    expect(guard(leaving)).toBe('');
    expect(leaving.preventDefault).toHaveBeenCalled();
  });
});

describe('the trigger options in the editor words', () => {
  const t = (key) =>
    ({
      'email-metadata-trigger-none': 'Aucun',
      'email-metadata-trigger-manual': 'Ponctuel',
      'email-metadata-trigger-manual-description': 'Décidé à chaque envoi',
      'email-metadata-trigger-automated': 'Automatisé',
    }[key] || key);

  it('gives a value with no description an empty one, never its key', () => {
    const options = translatedTriggerOptions({
      triggers: ['manual', 'automated'],
      trigger: 'manual',
      t,
    });

    expect(
      options.find((option) => option.value === 'manual').description
    ).toBe('Décidé à chaque envoi');
    expect(
      options.find((option) => option.value === 'automated').description
    ).toBe('');
  });
});

// #1525 (ADR-0024): what an email made before the taxonomy opens on.
describe('the selections an email opens with', () => {
  // Mosaico keeps each root property of the content in an observable.
  const contentOf = (values) =>
    Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, () => value])
    );
  const open = (content, taxonomyItemIds = []) =>
    openingSelections({
      dimensions: [MARKET, LANGUAGE],
      taxonomyItemIds,
      contract: { adopt: {} },
      content: contentOf(content),
    });

  it('adopts the market its content holds', () => {
    expect(open({ market: 'ca', headerVisible: true })).toEqual({
      selections: { market: 'ca', language: '' },
      gaps: {},
    });
  });

  it('lands the language on the only one offered under the adopted market', () => {
    const narrow = { ...LANGUAGE, values: LANGUAGE.values.slice(0, 2) };

    expect(
      openingSelections({
        dimensions: [MARKET, narrow],
        taxonomyItemIds: [],
        content: contentOf({ market: 'ca' }),
      }).selections
    ).toEqual({ market: 'ca', language: 'fr' });
  });

  it('keeps what the email carries over what its content holds', () => {
    expect(open({ market: 'ca' }, ['be']).selections).toEqual({
      market: 'be',
      language: '',
    });
  });

  it('adopts nothing from a market emptied and saved', () => {
    expect(open({ market: '' }).selections).toEqual({
      market: '',
      language: '',
    });
  });

  it('reports an identifier no value carries, under its dimension', () => {
    expect(open({ market: 'jp' }).gaps).toEqual({
      market: { identifier: 'jp', reason: 'UNKNOWN_IDENTIFIER' },
    });
  });
});

// #1525 (ADR-0024): what the content held and could not be adopted stays in
// the content until someone decides, rather than being wiped by the first write.
describe('what the template reads while a gap is reported', () => {
  const values = (selections, gaps) =>
    templateValuesFor({
      emailTypes: [],
      dimensions: [MARKET, LANGUAGE],
      selections,
      gaps,
    });
  const JP = { market: { identifier: 'jp', reason: 'UNKNOWN_IDENTIFIER' } };

  it('leaves out an empty dimension with a gap, so its property is kept', () => {
    expect(values({ market: '', language: '' }, JP)).not.toHaveProperty(
      'market'
    );
  });

  it('keeps the property of an empty child too: it waits for its parent', () => {
    expect(values({ market: '', language: '' }, JP)).not.toHaveProperty(
      'language'
    );
  });

  it('still publishes the dimensions the gap does not hold', () => {
    const audience = {
      name: 'audience',
      values: [{ id: 'pro', canonicalType: 'pro', isActive: true }],
    };

    expect(
      templateValuesFor({
        emailTypes: [],
        dimensions: [MARKET, LANGUAGE, audience],
        selections: { market: '', language: '', audience: '' },
        gaps: JP,
      })
    ).toHaveProperty('audience');
  });

  it('publishes the dimension once it has a value, a default included', () => {
    expect(values({ market: 'ca', language: '' }, JP)).toMatchObject({
      market: 'ca',
    });
  });

  it('publishes an empty value once the gap is dismissed by a choice', () => {
    expect(
      values({ market: '', language: '' }, { market: null })
    ).toHaveProperty('market');
  });
});

// Review of the stack: the template's own default comes first on a parent
// change too, as when the email was created (ADR-0024).
describe("the template's own default on a parent change", () => {
  it('lands the child on the value the template gives it, when offered', () => {
    const language = {
      ...LANGUAGE,
      templateDefault: 'fr',
      values: LANGUAGE.values.map((value) =>
        value.id === 'en' ? { ...value, defaultUnder: ['ca'] } : value
      ),
    };

    expect(
      nextSelections({
        dimensions: [MARKET, language],
        selections: { market: 'ca', language: 'nl' },
        changed: ['market'],
      })
    ).toEqual({ market: 'ca', language: 'fr' });
  });
});
