'use strict';

// The state of the dimension selects of the email settings, moved out of the
// editor plugin by #1519 so that it is tested: what the section opens with, what
// a change leaves, and what the template reads.

const {
  initialSelections,
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
