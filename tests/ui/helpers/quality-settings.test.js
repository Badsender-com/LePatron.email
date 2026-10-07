import {
  statesOf,
  statesPayload,
  thresholdsOf,
  thresholdErrors,
  orderErrors,
  settingsPayload,
  overridesOf,
  overridesPayload,
  overrideCount,
  checksByCategory,
  qualitySettingsErrorKeyFor,
} from '~/helpers/quality-settings.js';

// What the "Contrôle qualité" page reads from a group and sends back (epic
// #1193): a state equal to the default is sent as null, so the group follows
// the default again instead of pinning it.
describe('quality settings page helpers', () => {
  it("gives every check today's default when the group set nothing", () => {
    const states = statesOf(undefined);
    expect(states.headings).toBe('on');
    expect(states['tracking-params']).toBe('blocking');
  });

  it('reads the states the group set', () => {
    const states = statesOf({ checks: { headings: { state: 'off' } } });
    expect(states.headings).toBe('off');
    expect(states['emoji-placement']).toBe('on');
  });

  it('sends only the checks that changed, a default state as null', () => {
    const saved = statesOf({ checks: { subject: { state: 'off' } } });
    const states = { ...saved, headings: 'off', subject: 'on' };
    const { checks } = statesPayload(states, saved);
    expect(checks).toEqual({
      headings: { state: 'off' },
      subject: { state: null },
    });
  });

  it('lists every check once, by category', () => {
    const ids = checksByCategory().flatMap(({ ids: list }) => list);
    expect(ids).toHaveLength(Object.keys(statesOf(undefined)).length);
    expect(checksByCategory()[0].category).toBe('copy');
  });

  it('turns the invalid settings code into its own message', () => {
    const invalid = {
      response: { data: { message: 'INVALID_QUALITY_SETTINGS' } },
    };
    expect(qualitySettingsErrorKeyFor(invalid)).toBe(
      'qualitySettings.snackbars.invalid'
    );
    expect(qualitySettingsErrorKeyFor(new Error('Network Error'))).toBe(
      'qualitySettings.snackbars.error'
    );
  });

  it('reads the thresholds the group set, null where the default applies', () => {
    const thresholds = thresholdsOf({
      checks: { subject: { thresholds: { long: 30 } } },
    });
    expect(thresholds.subject).toEqual({ long: 30, tooLong: null });
    expect(thresholds['small-font']).toEqual({
      minSize: null,
      minSizeHeaderFooter: null,
    });
    expect(thresholds.headings).toBeUndefined();
  });

  it('names the thresholds outside their bounds', () => {
    const thresholds = {
      ...thresholdsOf(undefined),
      'small-font': { minSize: 2, minSizeHeaderFooter: 12 },
      'html-size': { maxKb: 150 },
    };
    expect(thresholdErrors(thresholds)).toEqual(['small-font.minSize']);
  });

  it('names the higher level of a pair set under the lower one', () => {
    const thresholds = {
      ...thresholdsOf(undefined),
      subject: { long: 70, tooLong: null },
      'images-total-weight': { warningKb: 300, errorKb: 400 },
    };
    expect(orderErrors(thresholds)).toEqual(['subject.tooLong']);
  });

  it('sends only the thresholds that changed, a default one as null', () => {
    const saved = thresholdsOf({
      checks: { 'html-size': { thresholds: { maxKb: 150 } } },
    });
    const thresholds = {
      ...saved,
      subject: { long: 30, tooLong: 60 },
      'html-size': { maxKb: null },
    };
    const { checks } = settingsPayload(
      statesOf(undefined),
      thresholds,
      statesOf(undefined),
      saved
    );
    expect(checks).toEqual({
      subject: { thresholds: { long: 30, tooLong: null } },
      'html-size': { thresholds: { maxKb: null } },
    });
  });

  it("reads a template's overrides, null where it follows the group", () => {
    const { states, thresholds } = overridesOf({
      checks: {
        headings: { state: 'off' },
        'small-font': { thresholds: { minSize: 11 } },
      },
    });
    expect(states.headings).toBe('off');
    expect(states.subject).toBeNull();
    expect(thresholds['small-font']).toEqual({
      minSize: 11,
      minSizeHeaderFooter: null,
    });
  });

  it('sends every setting the template follows the group on as null', () => {
    const { states, thresholds } = overridesOf(undefined);
    const { checks } = overridesPayload(
      { ...states, headings: 'on' },
      { ...thresholds, subject: { long: '30', tooLong: '' } }
    );
    expect(checks.headings).toEqual({ state: 'on' });
    expect(checks['emoji-placement']).toEqual({ state: null });
    expect(checks.subject).toEqual({
      state: null,
      thresholds: { long: 30, tooLong: null },
    });
  });

  it('counts the settings a template overrides', () => {
    expect(overrideCount(undefined)).toBe(0);
    expect(
      overrideCount({
        checks: {
          headings: { state: 'off' },
          subject: { thresholds: { long: 30, tooLong: 50 } },
        },
      })
    ).toBe(3);
  });
});
