import {
  CHECKS,
  CHECK_STATES,
  CHECK_CATEGORIES,
  SERVER_CHECKS,
} from '~/helpers/constants/quality-checks.js';
import en from '~/helpers/locales/en.js';
import fr from '~/helpers/locales/fr.js';

const SHARED = require('../../../packages/shared/quality/checks.js');

/**
 * The settings pages read the catalogue the editor and the server read, and
 * lay it out by category, with a label for everything they show.
 */
describe('the settings pages check catalogue', () => {
  it('is the shared one', () => {
    expect(CHECKS).toBe(SHARED.CHECKS);
    expect(CHECK_STATES).toBe(SHARED.CHECK_STATES);
  });

  it('reads the checks run by the server from the shared catalogue', () => {
    expect(SERVER_CHECKS).toBe(SHARED.SERVER_CHECKS);
  });

  it('lists every category its checks belong to', () => {
    const used = new Set(Object.values(CHECKS).map((check) => check.category));
    expect([...used].sort()).toEqual([...CHECK_CATEGORIES].sort());
  });

  it.each([
    ['en', en],
    ['fr', fr],
  ])('names every check and category in %s', (_lang, locale) => {
    Object.keys(CHECKS).forEach((id) => {
      expect(typeof locale.qualitySettings.checks[id]).toBe('string');
    });
    CHECK_CATEGORIES.forEach((category) => {
      expect(typeof locale.qualitySettings.categories[category]).toBe('string');
    });
  });

  it.each([
    ['en', en],
    ['fr', fr],
  ])('names every state, threshold and unit in %s', (_lang, locale) => {
    CHECK_STATES.forEach((state) => {
      expect(typeof locale.qualitySettings.states[state]).toBe('string');
    });
    Object.entries(CHECKS).forEach(([id, check]) => {
      Object.entries(check.thresholds).forEach(([name, threshold]) => {
        expect(typeof locale.qualitySettings.thresholds[id][name]).toBe(
          'string'
        );
        expect(typeof locale.qualitySettings.units[threshold.unit]).toBe(
          'string'
        );
      });
    });
  });
});
