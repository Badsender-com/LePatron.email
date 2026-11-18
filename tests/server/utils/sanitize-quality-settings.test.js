'use strict';

// What is stored on a group or a template, and what a template inherits, may
// hold values this sanitizer never wrote (a super admin edits these fields by
// hand). The order of paired thresholds is checked against finite numbers
// only, as resolveQualitySettings applies them: anything else falls back to
// the next level, then to the catalogue's default, and is not written back.

const {
  sanitizeQualitySettings,
} = require('../../../packages/server/utils/sanitize-quality-settings.js');

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
