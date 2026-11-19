import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  checksByCategory,
  loadQualitySettings,
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

  it('says why a change to a tech admin check was refused', () => {
    const refused = {
      response: {
        status: 403,
        data: { message: 'FORBIDDEN_TECH_QUALITY_CHECK' },
      },
    };
    expect(qualitySettingsErrorKeyFor(refused)).toBe(
      'qualitySettings.snackbars.forbidden'
    );
  });

  it('gives any other refusal the generic message', () => {
    const refused = { response: { status: 403, data: {} } };
    expect(qualitySettingsErrorKeyFor(refused)).toBe(
      'qualitySettings.snackbars.error'
    );
  });
});

describe('what the quality pages load', () => {
  const context = ({ group, templates }) => ({
    params: { groupId: 'g1' },
    store: { commit: jest.fn() },
    app: { i18n: { t: (key) => key } },
    $axios: {
      $get: jest.fn((url) => {
        const answer = url.endsWith('/templates') ? templates : group;
        return answer instanceof Error
          ? Promise.reject(answer)
          : Promise.resolve(answer);
      }),
    },
  });

  it('gives the group and its templates', async () => {
    const loaded = await loadQualitySettings(
      context({ group: { id: 'g1' }, templates: { items: [{ id: 't1' }] } })
    );
    expect(loaded).toEqual({
      group: { id: 'g1' },
      templates: [{ id: 't1' }],
      loadError: false,
    });
  });

  it('tells a group without templates from a list it could not read', async () => {
    const empty = await loadQualitySettings(
      context({ group: { id: 'g1' }, templates: { items: [] } })
    );
    expect(empty.loadError).toBe(false);
    const failed = await loadQualitySettings(
      context({ group: { id: 'g1' }, templates: new Error('Network Error') })
    );
    expect(failed).toEqual({
      group: { id: 'g1' },
      templates: [],
      loadError: true,
    });
  });

  it('is a load error when the group cannot be read', async () => {
    const loaded = await loadQualitySettings(
      context({ group: new Error('Network Error'), templates: { items: [] } })
    );
    expect(loaded.loadError).toBe(true);
  });
});
