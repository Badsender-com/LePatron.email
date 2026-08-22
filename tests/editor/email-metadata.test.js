'use strict';

// The editor has no component test harness, so the panel's decisions live in a
// helper module and are pinned here: what the counters say, how a date crosses
// the `<input type="date">` boundary without shifting a day, what the PATCH
// carries — and above all what it does NOT carry.

const {
  subjectCounter,
  counterState,
  toDateInputValue,
  fromDateInputValue,
  buildMetadataPayload,
  toFormState,
  typologyOptions,
  hasMetadataChanges,
  SUBJECT_RANGE,
} = require('../../packages/editor/src/js/utils/email-metadata.js');

describe('counters', () => {
  it('advises on the subject range, 30 to 50', () => {
    expect(SUBJECT_RANGE).toEqual({ min: 30, max: 50 });
    expect(subjectCounter('').state).toBe('empty');
    expect(subjectCounter('x'.repeat(29)).state).toBe('short');
    expect(subjectCounter('x'.repeat(30)).state).toBe('ok');
    expect(subjectCounter('x'.repeat(50)).state).toBe('ok');
    expect(subjectCounter('x'.repeat(51)).state).toBe('long');
  });

  it('reports the length so the panel can show "n / max"', () => {
    expect(subjectCounter('abc')).toEqual({
      length: 3,
      min: 30,
      max: 50,
      state: 'short',
    });
  });

  it.each([[null], [undefined]])('treats %p as empty', (value) => {
    expect(counterState(value, SUBJECT_RANGE)).toMatchObject({
      length: 0,
      state: 'empty',
    });
  });

  it('counts characters, not bytes', () => {
    expect(counterState('éàü', SUBJECT_RANGE).length).toBe(3);
  });
});

describe('toDateInputValue', () => {
  // The field only accepts yyyy-mm-dd, and it must show the day the user meant.
  it('renders a Date as yyyy-mm-dd', () => {
    expect(toDateInputValue(new Date(2026, 8, 1, 10, 0, 0))).toBe('2026-09-01');
  });

  it('pads month and day', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  // toISOString() would answer the previous day for an evening date in Paris.
  it('uses the local date, not the UTC one', () => {
    const evening = new Date(2026, 8, 1, 23, 30, 0);
    expect(toDateInputValue(evening)).toBe('2026-09-01');
  });

  it('accepts the ISO string the API returns', () => {
    expect(toDateInputValue('2026-09-01T08:00:00.000Z')).toBe('2026-09-01');
  });

  it.each([[null], [undefined], [''], ['pas une date'], [NaN]])(
    'returns an empty string for %p',
    (value) => {
      expect(toDateInputValue(value)).toBe('');
    }
  );
});

describe('fromDateInputValue', () => {
  it('sends an ISO string for a picked day', () => {
    const iso = fromDateInputValue('2026-09-01');
    expect(iso).toMatch(/^2026-09-01T/);
  });

  // Midnight would land on 2026-08-31 once stored in UTC west of Greenwich.
  it('anchors the day at noon so no timezone moves it', () => {
    const date = new Date(fromDateInputValue('2026-09-01'));
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(12);
  });

  it('round-trips through the field without shifting a day', () => {
    ['2026-01-01', '2026-06-15', '2026-12-31'].forEach((day) => {
      expect(toDateInputValue(fromDateInputValue(day))).toBe(day);
    });
  });

  it.each([[''], [null], [undefined], ['01/09/2026'], ['2026-9-1'], ['nawak']])(
    'returns null for %p, which clears the field',
    (value) => {
      expect(fromDateInputValue(value)).toBeNull();
    }
  );
});

describe('buildMetadataPayload', () => {
  it('carries the three fields the PATCH owns', () => {
    const payload = buildMetadataPayload({
      subject: 'Soldes',
      plannedSendDate: '2026-09-01',
      emailTypeId: '507f1f77bcf86cd799439101',
    });

    expect(payload.subject).toBe('Soldes');
    expect(payload.plannedSendDate).toMatch(/^2026-09-01T/);
    expect(payload._emailType).toBe('507f1f77bcf86cd799439101');
  });

  // The preheader is not part of the metadata at all in this phase: it is a
  // template property, edited in the template's own options.
  it('never carries the preheader, even if the caller passes one', () => {
    const payload = buildMetadataPayload({
      subject: 'x',
      preheader: 'ne doit pas partir',
    });

    expect(payload).not.toHaveProperty('preheader');
    expect(Object.keys(payload).sort()).toEqual([
      '_emailType',
      'plannedSendDate',
      'subject',
    ]);
  });

  it('trims the subject', () => {
    expect(buildMetadataPayload({ subject: '  Soldes  ' }).subject).toBe(
      'Soldes'
    );
  });

  it.each([[''], ['   '], [null], [undefined]])(
    'sends null for an emptied subject (%p), which clears it',
    (subject) => {
      expect(buildMetadataPayload({ subject }).subject).toBeNull();
    }
  );

  it.each([[''], [null], [undefined]])(
    'sends null for an emptied typology (%p)',
    (emailTypeId) => {
      expect(buildMetadataPayload({ emailTypeId })._emailType).toBeNull();
    }
  );
});

describe('toFormState', () => {
  it('fills the form from what the server exposed', () => {
    expect(
      toFormState({
        subject: 'Soldes',
        plannedSendDate: '2026-09-01T08:00:00.000Z',
        emailTypeId: '507f1f77bcf86cd799439101',
      })
    ).toEqual({
      subject: 'Soldes',
      plannedSendDate: '2026-09-01',
      emailTypeId: '507f1f77bcf86cd799439101',
    });
  });

  it.each([[undefined], [null], [{}]])(
    'opens on an empty form for %p',
    (values) => {
      expect(toFormState(values)).toEqual({
        subject: '',
        plannedSendDate: '',
        emailTypeId: '',
      });
    }
  );
});

describe('typologyOptions', () => {
  const types = [
    { id: 'a1', label: 'Infolettre' },
    { id: 'a2', label: 'Promo' },
  ];

  it('offers an explicit empty choice first', () => {
    const options = typologyOptions(types, '', 'Aucune');
    expect(options[0]).toEqual({ value: '', text: 'Aucune' });
    expect(options.map((o) => o.text)).toEqual([
      'Aucune',
      'Infolettre',
      'Promo',
    ]);
  });

  it('accepts _id as well as id', () => {
    expect(
      typologyOptions([{ _id: 'b1', label: 'X' }], '', 'Aucune')[1]
    ).toEqual({
      value: 'b1',
      text: 'X',
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
      { value: '', text: 'Aucune' },
    ]);
  });
});

describe('hasMetadataChanges', () => {
  const initial = {
    subject: 'Soldes',
    plannedSendDate: '2026-09-01',
    emailTypeId: 'a1',
  };

  it('says no when nothing moved', () => {
    expect(hasMetadataChanges({ ...initial }, initial)).toBe(false);
  });

  it.each([
    ['subject', { subject: 'Autre' }],
    ['plannedSendDate', { plannedSendDate: '2026-10-01' }],
    ['emailTypeId', { emailTypeId: 'a2' }],
  ])('detects a change of %s', (_field, change) => {
    expect(hasMetadataChanges({ ...initial, ...change }, initial)).toBe(true);
  });

  it('detects a field being cleared', () => {
    expect(hasMetadataChanges({ ...initial, subject: '' }, initial)).toBe(true);
  });

  it('treats an absent value and an empty one alike', () => {
    expect(
      hasMetadataChanges(
        { subject: '', plannedSendDate: '', emailTypeId: '' },
        { subject: undefined, plannedSendDate: null, emailTypeId: '' }
      )
    ).toBe(false);
  });
});
