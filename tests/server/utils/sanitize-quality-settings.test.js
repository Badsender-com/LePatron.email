'use strict';

// What is stored on a group or a template, and what a template inherits, may
// hold values this sanitizer never wrote (a super admin edits these fields by
// hand). The order of paired thresholds is checked against finite numbers
// only, as resolveQualitySettings applies them: anything else falls back to
// the next level, then to the catalogue's default, and is not written back.
//
// What the quality settings routes rely on to keep the required tracking
// parameters a tech admin's (ADR 0009): the comparison with what is stored,
// and the writes that leave the checks a save did not change alone.

const {
  sanitizeQualitySettings,
  keepsTechChecks,
  qualitySettingsUpdate,
} = require('../../../packages/server/utils/sanitize-quality-settings.js');

const CHECKS = 'qualitySettings.checks';

// subject: long 40 (warning), tooLong 60 (error) by default.
const subject = (thresholds) => ({ checks: { subject: { thresholds } } });

const refusal = (run) => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a refusal');
};

describe('sanitizeQualitySettings — values that are not numbers', () => {
  it.each([
    ['a string', 'abc'],
    ['an object', { $gt: 1 }],
    ['null', null],
    ['a numeric string', '300'],
  ])(
    'checks the order against the default when the stored value is %s',
    (_label, stored) => {
      // 70 is over the default tooLong of 60.
      const error = refusal(() =>
        sanitizeQualitySettings(
          subject({ long: 70 }),
          subject({ tooLong: stored })
        )
      );
      expect(error.status).toBe(422);
      expect(error.message).toBe('INVALID_QUALITY_SETTINGS');
    }
  );

  it('does not refuse against a stored numeric string', () => {
    // '30' would compare as 30, under 50: the default of 60 applies instead.
    expect(
      sanitizeQualitySettings(subject({ long: 50 }), subject({ tooLong: '30' }))
    ).toEqual(subject({ long: 50 }));
  });

  it('checks the order against the inherited value, skipping one that is not a number', () => {
    const inherited = (tooLong) => ({ subject: { tooLong } });
    expect(
      sanitizeQualitySettings(subject({ long: 70 }), undefined, inherited(80))
    ).toEqual(subject({ long: 70 }));
    const error = refusal(() =>
      sanitizeQualitySettings(subject({ long: 70 }), undefined, inherited('80'))
    );
    expect(error.status).toBe(422);
  });

  it('prefers a stored number to the inherited one', () => {
    expect(
      sanitizeQualitySettings(subject({ long: 70 }), subject({ tooLong: 80 }), {
        subject: { tooLong: 50 },
      })
    ).toEqual(subject({ long: 70, tooLong: 80 }));
  });

  it('does not write back a stored value that is not a number', () => {
    expect(
      sanitizeQualitySettings(
        subject({ long: 30 }),
        subject({ tooLong: 'abc', long: 20 })
      )
    ).toEqual(subject({ long: 30 }));
  });

  it('drops it as well when only the state of the check changes', () => {
    expect(
      sanitizeQualitySettings(
        { checks: { subject: { state: 'off' } } },
        { checks: { subject: { state: 'on', thresholds: { long: 'x' } } } }
      )
    ).toEqual({ checks: { subject: { state: 'off' } } });
  });

  it('leaves the checks the payload does not name as they are', () => {
    const stored = {
      checks: { preheader: { thresholds: { long: 'x' } } },
    };
    expect(
      sanitizeQualitySettings(
        { checks: { headings: { state: 'off' } } },
        stored
      )
    ).toEqual({
      checks: {
        preheader: { thresholds: { long: 'x' } },
        headings: { state: 'off' },
      },
    });
  });
});

// A group may move a threshold past one its template sets: resolution then
// makes the template's value win. Sending the template's settings back must
// not be refused for it; only a value the request changes is checked.
describe('sanitizeQualitySettings — a pair checked only on what changes', () => {
  // The template set long 50 when its group's tooLong was 60; the group then
  // lowered tooLong to 45.
  const stored = subject({ long: 50 });
  const inherited = { subject: { tooLong: 45 } };

  it("accepts the template's settings sent back unchanged", () => {
    // As the settings page sends them: every threshold, null when inherited.
    expect(
      sanitizeQualitySettings(
        subject({ long: 50, tooLong: null }),
        stored,
        inherited
      )
    ).toEqual(subject({ long: 50 }));
  });

  it('accepts a change to another check of the template', () => {
    expect(
      sanitizeQualitySettings(
        { checks: { headings: { state: 'off' } } },
        stored,
        inherited
      )
    ).toEqual({ checks: { ...stored.checks, headings: { state: 'off' } } });
  });

  it('refuses a new value of the template that contradicts the inherited one', () => {
    const error = refusal(() =>
      sanitizeQualitySettings(subject({ long: 55 }), stored, inherited)
    );
    expect(error.status).toBe(422);
    expect(error.details).toBe('subject.long must not exceed subject.tooLong');
  });

  it('refuses an own value removed for an inherited one that contradicts the other', () => {
    // Back to the group's tooLong of 45, under the template's long of 50.
    const error = refusal(() =>
      sanitizeQualitySettings(
        subject({ tooLong: null }),
        subject({ long: 50, tooLong: 50 }),
        inherited
      )
    );
    expect(error.status).toBe(422);
  });

  it('accepts a new value of the template that is in order with the inherited one', () => {
    expect(
      sanitizeQualitySettings(subject({ long: 40 }), stored, inherited)
    ).toEqual(subject({ long: 40 }));
  });
});

describe('keepsTechChecks', () => {
  it('holds when nothing is stored and nothing set', () => {
    expect(keepsTechChecks(undefined, { checks: {} })).toBe(true);
    expect(keepsTechChecks({ checks: 'odd' }, { checks: {} })).toBe(true);
  });

  it('holds for the same values, whatever the order of their keys', () => {
    const stored = {
      checks: { 'tracking-params': { state: 'off', thresholds: {} } },
    };
    const next = {
      checks: { 'tracking-params': { thresholds: {}, state: 'off' } },
    };
    expect(keepsTechChecks(stored, next)).toBe(true);
  });

  it('fails when the check is set, changed or removed', () => {
    const off = { checks: { 'tracking-params': { state: 'off' } } };
    const on = { checks: { 'tracking-params': { state: 'on' } } };
    expect(keepsTechChecks({ checks: {} }, off)).toBe(false);
    expect(keepsTechChecks(off, on)).toBe(false);
    expect(keepsTechChecks(off, { checks: {} })).toBe(false);
  });

  it('compares with what is stored, which the merge leaves as it was', () => {
    // The template route compares the stored value with the merged one: a
    // merge that changed the stored object in place would always compare
    // equal.
    const stored = { checks: { 'tracking-params': { state: 'off' } } };
    const next = sanitizeQualitySettings(
      { checks: { 'tracking-params': { state: null } } },
      stored
    );
    expect(stored).toEqual({
      checks: { 'tracking-params': { state: 'off' } },
    });
    expect(keepsTechChecks(stored, next)).toBe(false);
  });
});

describe('qualitySettingsUpdate', () => {
  it('writes only the checks that changed', () => {
    const stored = {
      checks: { headings: { state: 'off' }, subject: { state: 'on' } },
    };
    const next = {
      checks: { headings: { state: 'off' }, subject: { state: 'blocking' } },
    };
    expect(qualitySettingsUpdate(stored, next)).toEqual({
      $set: { [`${CHECKS}.subject`]: { state: 'blocking' } },
    });
  });

  it('removes the checks the merge left out', () => {
    expect(
      qualitySettingsUpdate(
        { checks: { headings: { state: 'off' } } },
        { checks: {} }
      )
    ).toEqual({ $unset: { [`${CHECKS}.headings`]: '' } });
  });

  it('writes into settings not stored yet', () => {
    expect(
      qualitySettingsUpdate(undefined, {
        checks: { headings: { state: 'off' } },
      })
    ).toEqual({ $set: { [`${CHECKS}.headings`]: { state: 'off' } } });
  });

  it('writes nothing when nothing changed', () => {
    const stored = { checks: { headings: { state: 'off' } } };
    expect(
      qualitySettingsUpdate(stored, { checks: { ...stored.checks } })
    ).toEqual({});
  });

  it('replaces settings of another shape as a whole', () => {
    const next = { checks: { headings: { state: 'off' } } };
    expect(qualitySettingsUpdate('odd', next)).toEqual({
      $set: { qualitySettings: next },
    });
    expect(qualitySettingsUpdate({ checks: [] }, next)).toEqual({
      $set: { qualitySettings: next },
    });
  });

  // MongoDB refuses to create `checks` inside a null field: a write check by
  // check would answer a 500.
  it.each([
    ['null settings', null],
    ['null checks', { checks: null }],
    ['checks of another shape', { checks: 'odd' }],
    ['a number', 3],
  ])('replaces %s as a whole', (_, stored) => {
    const next = { checks: { headings: { state: 'off' } } };
    expect(qualitySettingsUpdate(stored, next)).toEqual({
      $set: { qualitySettings: next },
    });
  });
});
