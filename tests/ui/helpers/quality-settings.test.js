import {
  statesOf,
  statesPayload,
  thresholdsOf,
  thresholdErrors,
  settingsPayload,
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
});
