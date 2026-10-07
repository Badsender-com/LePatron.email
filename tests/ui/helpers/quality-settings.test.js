import {
  statesOf,
  statesPayload,
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

  it('sends a state equal to the default as null', () => {
    const states = { ...statesOf(undefined), headings: 'off' };
    const { checks } = statesPayload(states);
    expect(checks.headings).toEqual({ state: 'off' });
    expect(checks['emoji-placement']).toEqual({ state: null });
    expect(checks['tracking-params']).toEqual({ state: null });
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
});
