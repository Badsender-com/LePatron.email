import {
  CHECKS,
  CHECK_STATES,
  CHECK_CATEGORIES,
} from '~/helpers/constants/quality-checks.js';
import en from '~/helpers/locales/en.js';
import fr from '~/helpers/locales/fr.js';

const SHARED = require('../../../packages/shared/quality/checks.js');

/**
 * The settings page has its own copy of the check catalogue, the Nuxt app
 * having no import path into packages/shared. A check, a bound or a default
 * changed on one side only would let the page offer a value the server refuses
 * with a 422, or hide a check the editor runs.
 */
describe('the settings page copy of the check catalogue', () => {
  it('has the same check states', () => {
    expect(CHECK_STATES).toEqual(SHARED.CHECK_STATES);
  });

  it('has the same checks, categories, defaults and bounds', () => {
    expect(JSON.parse(JSON.stringify(CHECKS))).toEqual(
      JSON.parse(JSON.stringify(SHARED.CHECKS))
    );
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
});
