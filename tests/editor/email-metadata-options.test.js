'use strict';

// What the two selects offer. The failure worth pinning in each: an option the
// email points at silently dropped, which rewrites the email on the next save.

const {
  typologyOptions,
  triggerOptions,
  selectedDescription,
} = require('../../packages/editor/src/js/utils/email-metadata-options.js');

describe('typologyOptions', () => {
  const types = [
    {
      id: 'a1',
      label: 'Infolettre',
      description: 'Notre rendez-vous mensuel.',
    },
    { id: 'a2', label: 'Promo' },
  ];

  it('offers an explicit empty choice first', () => {
    const options = typologyOptions(types, '', 'Aucune');
    expect(options[0]).toEqual({ value: '', text: 'Aucune', description: '' });
    expect(options.map((o) => o.text)).toEqual([
      'Aucune',
      'Infolettre',
      'Promo',
    ]);
  });

  // Defensive: the server always sends `id`. An item without one used to become an
  // option valued `'undefined'` — selectable, and refused on save with nothing on
  // screen explaining why.
  it('drops an item that carries no id at all', () => {
    const options = typologyOptions(
      [{ id: 'a1', label: 'Infolettre' }, { label: 'Sans id' }, null],
      '',
      'Aucune'
    );
    expect(options.map((o) => o.text)).toEqual(['Aucune', 'Infolettre']);
  });

  it('accepts _id as well as id', () => {
    expect(
      typologyOptions([{ _id: 'b1', label: 'X' }], '', 'Aucune')[1]
    ).toEqual({
      value: 'b1',
      text: 'X',
      description: '',
    });
  });

  // An email may point at a typology deactivated since. Dropping it silently
  // would rewrite the email's typology on the next save.
  it('keeps a typology that is no longer offered, flagged and named apart', () => {
    const options = typologyOptions(types, 'gone', 'Aucune', 'Désactivée');
    const kept = options.find((o) => o.value === 'gone');

    expect(kept).toBeDefined();
    expect(kept.missing).toBe(true);
    // Not "Aucune": two identical labels would hide the fact that the email
    // points at a withdrawn typology.
    expect(kept.text).toBe('Désactivée');
    expect(options.filter((o) => o.text === 'Aucune')).toHaveLength(1);
  });

  it('falls back on the empty label when no missing label is given', () => {
    const options = typologyOptions(types, 'gone', 'Aucune');
    expect(options.find((o) => o.value === 'gone').text).toBe('Aucune');
  });

  it('does not duplicate the current typology when it is still offered', () => {
    const options = typologyOptions(types, 'a1', 'Aucune');
    expect(options.filter((o) => o.value === 'a1')).toHaveLength(1);
  });

  it.each([[undefined], [null], [[]]])('survives %p', (list) => {
    expect(typologyOptions(list, '', 'Aucune')).toEqual([
      { value: '', text: 'Aucune', description: '' },
    ]);
  });

  // The company's own definition, shown under the field once a typology is picked.
  // Kept OUT of the option text, unlike the trigger's: this is a free field of up
  // to 2000 characters.
  it('carries the definition of each typology', () => {
    const options = typologyOptions(types, '', 'Aucune');

    expect(options[1].description).toBe('Notre rendez-vous mensuel.');
    expect(options[1].text).toBe('Infolettre');
  });

  it('gives a typology without a definition an empty one, never undefined', () => {
    expect(typologyOptions(types, '', 'Aucune')[2].description).toBe('');
  });
});

describe('selectedDescription', () => {
  const options = [
    { value: '', text: 'Aucune', description: '' },
    {
      value: 'a1',
      text: 'Infolettre',
      description: 'Notre rendez-vous mensuel.',
    },
    { value: 'a2', text: 'Promo', description: '' },
  ];

  it('answers the definition of the selected option', () => {
    expect(selectedDescription(options, 'a1')).toBe(
      'Notre rendez-vous mensuel.'
    );
  });

  // "nothing selected" and "selected, but no definition" have to resolve to the
  // same thing — an empty hint, not the word "undefined" under the field.
  it.each([[''], [null], [undefined], ['a2'], ['gone']])(
    'answers an empty string for %p',
    (value) => {
      expect(selectedDescription(options, value)).toBe('');
    }
  );

  it.each([[undefined], [null], [[]]])('survives %p', (list) => {
    expect(selectedDescription(list, 'a1')).toBe('');
  });

  it('compares values as strings, as the select hands them back', () => {
    expect(
      selectedDescription([{ value: 12, description: 'douze' }], '12')
    ).toBe('douze');
  });
});

describe('triggerOptions', () => {
  const labels = { adhoc: 'Ad hoc', automated: 'Automatisé' };
  const labelFor = (value) => labels[value];

  it('offers the empty choice first, then the values the server sent', () => {
    expect(triggerOptions(['adhoc', 'automated'], 'Aucun', labelFor)).toEqual([
      { value: '', text: 'Aucun', description: '' },
      { value: 'adhoc', text: 'Ad hoc', description: '' },
      { value: 'automated', text: 'Automatisé', description: '' },
    ]);
  });

  it('keeps the order the server sent rather than sorting', () => {
    const texts = triggerOptions(['automated', 'adhoc'], 'Aucun', labelFor).map(
      (option) => option.value
    );

    expect(texts).toEqual(['', 'automated', 'adhoc']);
  });

  // Same reasoning as typologyOptions: dropping the value the email points at
  // would silently rewrite its trigger on the next save.
  it('adds back a value it has no label for, shown raw', () => {
    expect(
      triggerOptions(['adhoc'], 'Aucun', labelFor, 'scheduled')
    ).toContainEqual({
      value: 'scheduled',
      text: 'scheduled',
      description: '',
    });
  });

  it('does not duplicate the value the email already carries', () => {
    const options = triggerOptions(
      ['adhoc', 'automated'],
      'Aucun',
      labelFor,
      'adhoc'
    );

    expect(options.filter((o) => o.value === 'adhoc')).toHaveLength(1);
  });

  // A server that sent nothing leaves the user with one honest choice rather than
  // a select that looks broken.
  it.each([[[]], [undefined], [null]])('survives %p', (triggers) => {
    expect(triggerOptions(triggers, 'Aucun', labelFor)).toEqual([
      { value: '', text: 'Aucun', description: '' },
    ]);
  });

  it('falls back to the raw value when the label is missing', () => {
    expect(triggerOptions(['adhoc'], 'Aucun', () => '')).toContainEqual({
      value: 'adhoc',
      text: 'adhoc',
      description: '',
    });
  });

  // The definition rides ALONGSIDE the label, never inside it. Folding it into the
  // option text was tried and undone: a native select repeats the chosen option's
  // full text once closed, so the field read "Automatisé — décidé par une règle, à
  // chaque fois" permanently. Same treatment as the typology now.
  it('carries the definition without touching the label', () => {
    const describe = (value) =>
      value === 'adhoc' ? "Un envoi décidé par l'équipe, pour cette fois." : '';

    const [, adhoc] = triggerOptions(
      ['adhoc'],
      'Aucun',
      labelFor,
      null,
      describe
    );

    expect(adhoc.text).toBe('Ad hoc');
    expect(adhoc.description).toBe(
      "Un envoi décidé par l'équipe, pour cette fois."
    );
  });

  it.each([[() => ''], [undefined], [() => undefined]])(
    'gives an empty description, never undefined (%p)',
    (describe) => {
      const [, adhoc] = triggerOptions(
        ['adhoc'],
        'Aucun',
        labelFor,
        null,
        describe
      );

      expect(adhoc.text).toBe('Ad hoc');
      expect(adhoc.description).toBe('');
    }
  );

  it('leaves the empty choice without a description', () => {
    const [none] = triggerOptions(
      ['adhoc'],
      'Aucun',
      labelFor,
      null,
      () => 'quelque chose'
    );

    expect(none).toEqual({ value: '', text: 'Aucun', description: '' });
  });
});
