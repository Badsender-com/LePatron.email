import {
  recommendedOf,
  exceptionsOf,
  emptyException,
  generalOf,
} from '~/helpers/quality-exceptions.js';
import { exceptionsPayload, fieldErrors } from '~/helpers/quality-save.js';

// What saving a level of the "Contrôle qualité" page sends and refuses, as
// the server's sanitizer does (ADR 0009).

const general = {
  checks: {
    subject: { thresholds: { tooLong: 80 } },
    'merge-tags': { state: 'blocking' },
  },
};

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
