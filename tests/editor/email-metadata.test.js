'use strict';

// The editor has no component test harness, so the section's decisions live in a
// helper module and are pinned here: how a date crosses the `<input type="date">`
// boundary without shifting a day, what the PATCH carries — and above all what it
// does NOT carry.

const {
  toDateInputValue,
  fromDateInputValue,
  buildMetadataPayload,
  toFormState,
  typologyOptions,
  hasMetadataChanges,
  errorKeyFor,
  SUBJECT_HARD_LIMIT,
} = require('../../packages/editor/src/js/utils/email-metadata.js');

describe('toDateInputValue', () => {
  // The field only accepts yyyy-mm-dd, and it must show the day the user meant —
  // the same day for every teammate, whatever their timezone.
  it('renders the stored instant as yyyy-mm-dd', () => {
    expect(toDateInputValue('2026-09-01T12:00:00.000Z')).toBe('2026-09-01');
  });

  it('pads month and day', () => {
    expect(toDateInputValue('2026-01-05T12:00:00.000Z')).toBe('2026-01-05');
  });

  // The whole point of reading in UTC: noon UTC is the same calendar day for
  // every offset from -11 to +12, so two colleagues never see different days.
  it('reads the day in UTC, not in the local timezone', () => {
    const noonUtc = new Date(Date.UTC(2026, 8, 1, 12));
    expect(toDateInputValue(noonUtc)).toBe('2026-09-01');
    // Same instant, expressed the way the API sends it back.
    expect(toDateInputValue(noonUtc.toISOString())).toBe('2026-09-01');
  });

  it('accepts the ISO string the API returns', () => {
    expect(toDateInputValue('2026-09-01T12:00:00.000Z')).toBe('2026-09-01');
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

  // Midnight UTC would land on 2026-08-31 for anyone west of Greenwich, and noon
  // LOCAL — what this did before — shifts between two users: noon in Los Angeles
  // is 19:00Z, which is already 2026-09-02 in Tokyo.
  it('anchors the day at noon UTC so no timezone moves it', () => {
    const date = new Date(fromDateInputValue('2026-09-01'));
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(8);
    expect(date.getUTCDate()).toBe(1);
    expect(date.getUTCHours()).toBe(12);
  });

  // The property that matters, and the one the previous implementation broke: the
  // instant written for a given day does not depend on where the person saving it
  // happens to be. `new Date(y, m, d, 12)` did — it built noon LOCAL, so the same
  // picked day produced a different instant in Paris and in Los Angeles, and the
  // two disagreed about the date once either of them read it back.
  //
  // Asserting the exact string is the point: any reintroduction of a local-time
  // constructor moves it.
  it('writes the same instant whatever the machine timezone', () => {
    expect(fromDateInputValue('2026-09-01')).toBe('2026-09-01T12:00:00.000Z');
    expect(fromDateInputValue('2026-01-01')).toBe('2026-01-01T12:00:00.000Z');
    // A summer date and a winter one, because a local-time implementation also
    // drifts by an hour across a daylight-saving boundary.
    expect(fromDateInputValue('2026-06-15')).toBe('2026-06-15T12:00:00.000Z');
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
    expect(payload.emailTypeId).toBe('507f1f77bcf86cd799439101');
  });

  // The preheader is not part of the metadata at all in this phase: it is a
  // template property, edited in the template's own options.
  it('never carries the preheader, even if the caller passes one', () => {
    const payload = buildMetadataPayload({
      subject: 'x',
      preheader: 'must not travel',
    });

    expect(payload).not.toHaveProperty('preheader');
    expect(Object.keys(payload).sort()).toEqual([
      'emailTypeId',
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
      expect(buildMetadataPayload({ emailTypeId }).emailTypeId).toBeNull();
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

describe('errorKeyFor', () => {
  const asAxiosError = (code) => ({ response: { data: { message: code } } });

  // Each server code has to reach its own message: a typo would degrade silently
  // to the generic one, and the section is the only place these are shown.
  it.each([
    ['EMAIL_METADATA_DISABLED', 'email-metadata-error-disabled'],
    ['EMAIL_TYPE_NOT_FOUND', 'email-metadata-error-typology'],
    ['EMAIL_TYPE_COMPANY_MISSING', 'email-metadata-error-no-company'],
    ['INVALID_EMAIL_METADATA', 'email-metadata-error-invalid'],
  ])('maps %s onto %s', (code, key) => {
    expect(errorKeyFor(asAxiosError(code))).toBe(key);
  });

  // Anything else falls back on the generic message rather than showing a raw
  // server sentence, which would be untranslated at best.
  it.each([
    ['an unknown code', asAxiosError('SOMETHING_ELSE')],
    ['a network error with no response', new Error('Network Error')],
    ['no error at all', null],
    ['a response with no body', { response: {} }],
  ])('falls back to the generic message for %s', (_case, error) => {
    expect(errorKeyFor(error)).toBe('email-metadata-error');
  });
});

// Two constants, two packages, one rule. The editor warns at 50 and hard-stops the
// input at the server's own maximum; if the server lowers it, the input would
// accept a value the PATCH refuses.
describe('SUBJECT_HARD_LIMIT', () => {
  it('matches the server MAX_SUBJECT_LENGTH', () => {
    const {
      MAX_SUBJECT_LENGTH,
    } = require('../../packages/server/mailing/mailing-metadata.service.js');
    expect(SUBJECT_HARD_LIMIT).toBe(MAX_SUBJECT_LENGTH);
  });
});
