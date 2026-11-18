import {
  recommendedOf,
  exceptionsOf,
  emptyException,
  generalOf,
  effectiveOf,
  isEmptyException,
  matchesBase,
  sameException,
  exceptionsPayload,
  fieldErrors,
  exceptionCount,
  blocksFrom,
  adjustmentsOf,
  valuesEqualToBase,
} from '~/helpers/quality-exceptions.js';

// The "Contrôle qualité" page shows exceptions only (ADR 0009, admin design
// v4): what a group sets for every template (the general settings), and what
// one template sets for itself. Everything else applies the recommended
// values, the catalogue's.

const general = {
  checks: {
    subject: { thresholds: { tooLong: 80 } },
    'merge-tags': { state: 'blocking' },
  },
};

describe('the exceptions of a level', () => {
  it('reads only what is set, on the catalogue checks', () => {
    expect(
      exceptionsOf({
        checks: {
          subject: { thresholds: { tooLong: 80 } },
          headings: { state: 'off' },
          constructor: { state: 'off' },
        },
      })
    ).toEqual({
      subject: { state: null, thresholds: { long: null, tooLong: 80 } },
      headings: { state: 'off', thresholds: {} },
    });
  });

  it('has none when nothing is stored', () => {
    expect(exceptionsOf(undefined)).toEqual({});
    expect(exceptionsOf({ checks: { headings: {} } })).toEqual({});
  });

  it('starts a new exception with nothing set', () => {
    expect(emptyException('subject')).toEqual({
      state: null,
      thresholds: { long: null, tooLong: null },
    });
    expect(isEmptyException(emptyException('subject'))).toBe(true);
  });
});

describe('what applies', () => {
  it('gives the recommended values of a check', () => {
    expect(recommendedOf('subject')).toEqual({
      state: 'on',
      thresholds: { long: 40, tooLong: 60 },
    });
    expect(recommendedOf('tracking-params').state).toBe('blocking');
  });

  it('lays the general settings over the recommended values', () => {
    const applied = generalOf(general);
    expect(applied.subject).toEqual({
      state: 'on',
      thresholds: { long: 40, tooLong: 80 },
    });
    expect(applied['merge-tags'].state).toBe('blocking');
    expect(applied.headings.state).toBe('on');
  });

  it('lays an exception over what it replaces', () => {
    const base = generalOf(general).subject;
    expect(
      effectiveOf(
        { state: 'blocking', thresholds: { long: '45', tooLong: null } },
        base
      )
    ).toEqual({ state: 'blocking', thresholds: { long: 45, tooLong: 80 } });
  });

  it("resolves a template's exception as the server does", () => {
    // The template's "too long" of 50 wins over a general "long" of 70.
    const base = generalOf({
      checks: { subject: { thresholds: { long: 70 } } },
    }).subject;
    const ex = { state: null, thresholds: { long: null, tooLong: '50' } };
    expect(effectiveOf(ex, base, 'subject')).toEqual({
      state: 'on',
      thresholds: { long: 50, tooLong: 50 },
    });
    expect(adjustmentsOf('subject', ex, base)).toEqual([
      { threshold: 'long', inherited: 70, value: 50 },
    ]);
    // In order, nothing moves.
    expect(adjustmentsOf('subject', ex, recommendedOf('subject'))).toEqual([]);
  });

  it('tells an exception that changes nothing', () => {
    const base = recommendedOf('subject');
    expect(
      matchesBase(
        { state: 'on', thresholds: { long: 40, tooLong: null } },
        base
      )
    ).toBe(true);
    expect(
      matchesBase(
        { state: null, thresholds: { long: 45, tooLong: null } },
        base
      )
    ).toBe(false);
  });

  it("names a template's values equal to the general ones", () => {
    // Kept on save (D3), but they will not follow the general settings.
    const base = generalOf(general)['merge-tags'];
    expect(
      valuesEqualToBase({ state: 'blocking', thresholds: {} }, base)
    ).toEqual(['state']);
    const subject = generalOf(general).subject;
    expect(
      valuesEqualToBase(
        { state: 'blocking', thresholds: { long: '40', tooLong: 70 } },
        subject
      )
    ).toEqual(['long']);
    expect(valuesEqualToBase(emptyException('subject'), subject)).toEqual([]);
  });

  it('tells an unsaved change, an empty field and null alike', () => {
    const saved = { state: 'off', thresholds: { long: 45, tooLong: null } };
    expect(
      sameException(saved, {
        state: 'off',
        thresholds: { long: '45', tooLong: '' },
      })
    ).toBe(true);
    expect(
      sameException(saved, {
        state: 'on',
        thresholds: { long: 45, tooLong: null },
      })
    ).toBe(false);
    expect(sameException(emptyException('subject'), null)).toBe(false);
  });

  it('counts the checks a level has an exception on', () => {
    expect(exceptionCount(general)).toBe(2);
    expect(exceptionCount(null)).toBe(0);
  });
});

describe('blocking', () => {
  // Only the most severe level of a blocking check blocks (ADR 0009): a
  // subject of 55 characters, over the info level only, still goes out.
  it('blocks a pair past its most severe level, as it applies', () => {
    expect(blocksFrom('subject', { long: 45, tooLong: 80 })).toEqual({
      name: 'tooLong',
      value: 80,
    });
    expect(blocksFrom('preheader', { long: 100, tooLong: 140 })).toEqual({
      name: 'tooLong',
      value: 140,
    });
    expect(
      blocksFrom('images-total-weight', { warningKb: 500, errorKb: 1024 })
    ).toEqual({ name: 'errorKb', value: 1024 });
  });

  it('says nothing more for a check without a pair', () => {
    expect(blocksFrom('html-size', { maxKb: 100 })).toBeNull();
    expect(blocksFrom('headings', {})).toBeNull();
  });
});

describe('the errors of a field', () => {
  const base = recommendedOf('subject');

  it('names a value outside its bounds', () => {
    const errors = fieldErrors(
      'subject',
      { state: null, thresholds: { long: 5, tooLong: null } },
      base
    );
    expect(errors).toEqual({
      long: {
        key: 'qualitySettings.thresholdError',
        params: { min: 10, max: 200 },
      },
    });
  });

  it('compares a pair on what applies, on the field edited last', () => {
    // The general "too long" is 80: a template's "long" of 90 is above it.
    const applied = generalOf(general).subject;
    const ex = { state: null, thresholds: { long: 90, tooLong: null } };
    expect(fieldErrors('subject', ex, applied, 'long')).toEqual({
      long: { key: 'qualitySettings.orderErrorHigh', params: { value: 80 } },
    });
  });

  it('puts the error on the higher level when both are set', () => {
    const ex = { state: null, thresholds: { long: 70, tooLong: 50 } };
    expect(fieldErrors('subject', ex, base, 'tooLong')).toEqual({
      tooLong: { key: 'qualitySettings.orderError', params: { value: 70 } },
    });
    expect(fieldErrors('subject', ex, base, null)).toEqual({
      tooLong: { key: 'qualitySettings.orderError', params: { value: 70 } },
    });
    expect(fieldErrors('subject', ex, base, 'long')).toEqual({
      long: { key: 'qualitySettings.orderErrorHigh', params: { value: 50 } },
    });
  });

  it('checks a pair only when the edit changes one of its values', () => {
    // Saved with the general "long" at 40; the company then moved it to 70.
    const moved = generalOf({
      checks: { subject: { thresholds: { long: 70 } } },
    }).subject;
    const saved = { state: null, thresholds: { long: null, tooLong: 50 } };
    expect(fieldErrors('subject', saved, moved, null, saved)).toEqual({});
    // Another change to the same exception still saves, as the server
    // accepts it: the value sent back as it is is not checked again.
    const edited = { ...saved, state: 'blocking' };
    expect(fieldErrors('subject', edited, moved, null, saved)).toEqual({});
    expect(
      exceptionsPayload('template', { subject: edited }, { subject: saved })
    ).toEqual({
      checks: {
        subject: { state: 'blocking', thresholds: { long: null, tooLong: 50 } },
      },
    });
    // Changing the value itself is checked against what is inherited.
    const changed = { state: null, thresholds: { long: null, tooLong: 55 } };
    expect(fieldErrors('subject', changed, moved, 'tooLong', saved)).toEqual({
      tooLong: { key: 'qualitySettings.orderError', params: { value: 70 } },
    });
  });

  it('has none for values in bounds and in order', () => {
    const ex = { state: null, thresholds: { long: 45, tooLong: '70' } };
    expect(fieldErrors('subject', ex, base, 'long')).toEqual({});
  });
});

describe('the payload that saves a level', () => {
  it('sends only the checks that changed', () => {
    const saved = exceptionsOf(general);
    const drafts = {
      ...saved,
      headings: { state: 'off', thresholds: {} },
    };
    expect(exceptionsPayload('general', drafts, saved)).toEqual({
      checks: { headings: { state: 'off', thresholds: null } },
    });
  });

  it('removes an exception left out, or one with nothing set', () => {
    const saved = exceptionsOf(general);
    const drafts = { subject: emptyException('subject') };
    expect(exceptionsPayload('template', drafts, saved)).toEqual({
      checks: {
        subject: { state: null, thresholds: null },
        'merge-tags': { state: null, thresholds: null },
      },
    });
  });

  it('drops a general value equal to the recommended one', () => {
    const drafts = {
      subject: { state: 'on', thresholds: { long: 40, tooLong: '70' } },
    };
    expect(exceptionsPayload('general', drafts, {})).toEqual({
      checks: {
        subject: { state: null, thresholds: { long: null, tooLong: 70 } },
      },
    });
    // Nothing left: the exception is removed, nothing travels.
    expect(
      exceptionsPayload(
        'general',
        { subject: { state: 'on', thresholds: { long: 40, tooLong: null } } },
        {}
      )
    ).toEqual({ checks: {} });
  });

  // Code review: stored values equal to the recommended ones (set through
  // the API, or the catalogue's default changed since) made a removal look
  // like no change, and the exception came back on reload.
  it('removes a general exception equal to the recommended values', () => {
    const saved = exceptionsOf({
      checks: { subject: { state: 'on', thresholds: { long: 40 } } },
    });
    expect(exceptionsPayload('general', {}, saved)).toEqual({
      checks: { subject: { state: null, thresholds: null } },
    });
    // Left in place, it is no change.
    expect(exceptionsPayload('general', saved, saved)).toEqual({ checks: {} });
  });

  it("keeps a template's value equal to the general one", () => {
    // It will not follow the general settings' later changes.
    const drafts = { 'merge-tags': { state: 'blocking', thresholds: {} } };
    expect(exceptionsPayload('template', drafts, {})).toEqual({
      checks: { 'merge-tags': { state: 'blocking', thresholds: null } },
    });
  });
});
