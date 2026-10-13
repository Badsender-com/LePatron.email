import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  checksByCategory,
  qualitySettingsErrorKeyFor,
} from '~/helpers/quality-settings.js';

// What the "Contrôle qualité" pages share besides the exceptions
// (quality-exceptions.test.js).
describe('quality settings page helpers', () => {
  it('lists every check once, by category', () => {
    const ids = checksByCategory().flatMap(({ ids: list }) => list);
    expect(ids.sort()).toEqual(Object.keys(CHECKS).sort());
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
