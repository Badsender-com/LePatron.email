'use strict';

// Acceptance tests of the dimension roles and the normalised codes (epic #1501,
// ADR-0023).
//
// A company dimension may carry a role, `language`, `country` or `locale`: at
// most one dimension per role in a company, never the email type nor the
// trigger. Each value of such a dimension may carry a normalised code from the
// role's standard list, in a field of its own: the identifier stays free.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const models = require('../../../packages/server/common/models.common.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  adminA,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const declare = (payload) =>
  dimensionService.createDimension({ user: adminA, payload });
const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });
const dimensionNamed = async (name) =>
  (await dimensionService.listDimensions({ user: adminA })).find(
    (dimension) => dimension.name === name
  );

beforeEach(() => resetTaxonomyModels(models));

// Turned on by #1503 (a dimension carries a role, its values a normalised code)
describe.skip('dimension roles', () => {
  it('gives a dimension the language role', async () => {
    const language = await declare({
      name: 'language',
      label: 'Langue',
      role: 'language',
    });

    expect(language.role).toBe('language');
  });

  it('gives a role to an existing dimension, and takes it back', async () => {
    const market = await declare({ name: 'market', label: 'Marché' });

    const withRole = await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(market),
      payload: { role: 'country' },
    });
    expect(withRole.role).toBe('country');

    const without = await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(market),
      payload: { role: null },
    });
    expect(without.role).toBeFalsy();
  });

  it('refuses a second dimension claiming a role already taken', async () => {
    await declare({ name: 'language', label: 'Langue', role: 'language' });

    await expect(
      declare({ name: 'idiom', label: 'Idiome', role: 'language' })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_ROLE_TAKEN,
    });
  });

  it('lets a deactivated dimension keep its role, so no other can take it', async () => {
    const language = await declare({
      name: 'language',
      label: 'Langue',
      role: 'language',
    });
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(language),
      payload: { isActive: false },
    });

    await expect(
      declare({ name: 'idiom', label: 'Idiome', role: 'language' })
    ).rejects.toMatchObject({ status: 409 });
  });

  it.each(['emailType', 'trigger'])(
    'refuses a role on the standard dimension %s',
    async (name) => {
      const standard = await dimensionNamed(name);

      await expect(
        dimensionService.updateDimension({
          user: adminA,
          dimensionId: idOf(standard),
          payload: { role: 'language' },
        })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_DIMENSION,
      });
    }
  );

  it.each(['lang', 'Language', 42])('refuses %p as a role', async (role) => {
    await expect(
      declare({ name: 'language', label: 'Langue', role })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });

  it('refuses a dimension named locale, the property the application publishes', async () => {
    await expect(
      declare({ name: 'locale', label: 'Locale' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });
});

// Turned on by #1503 (a dimension carries a role, its values a normalised code)
describe.skip('normalised codes', () => {
  beforeEach(async () => {
    await declare({ name: 'language', label: 'Langue', role: 'language' });
    await declare({ name: 'market', label: 'Marché', role: 'country' });
    await declare({
      name: 'marketLanguage',
      label: 'Marché-langue',
      role: 'locale',
    });
    await declare({ name: 'brand', label: 'Marque' });
  });

  it('gives a value its code, beside an identifier that stays free', async () => {
    const french = await addValue('language', {
      label: 'Français',
      canonicalType: 'francais',
      code: 'fr',
    });

    expect(french).toMatchObject({ canonicalType: 'francais', code: 'fr' });
  });

  it.each([
    ['language', 'FR', 'fr'],
    ['market', 'be', 'BE'],
    ['marketLanguage', 'FR-be', 'fr-BE'],
    ['marketLanguage', 'nl', 'nl'],
  ])('stores the %s code %p as %p', async (type, code, stored) => {
    const value = await addValue(type, { label: 'Une valeur', code });

    expect(value.code).toBe(stored);
  });

  it.each([
    ['language', 'xx'],
    ['language', 'fr-BE'],
    ['language', 'fra'],
    ['market', 'XX'],
    ['market', 'BEL'],
    ['marketLanguage', 'fr_BE'],
    ['marketLanguage', 'fr-XX'],
  ])('refuses the %s code %p, outside its list', async (type, code) => {
    await expect(
      addValue(type, { label: 'Une valeur', code })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('accepts a value with no code', async () => {
    const other = await addValue('language', { label: 'Multilingue' });

    expect(other.code).toBeFalsy();
  });

  it('lets two values share a code', async () => {
    await addValue('language', { label: 'Français', code: 'fr' });

    const plain = await addValue('language', {
      label: 'Français simplifié',
      code: 'fr',
    });

    expect(plain.code).toBe('fr');
  });

  it('refuses a code on a value whose dimension has no role', async () => {
    await expect(
      addValue('brand', { label: 'Marque A', code: 'fr' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('clears a code with null', async () => {
    const french = await addValue('language', {
      label: 'Français',
      code: 'fr',
    });

    const cleared = await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(french),
      payload: { code: null },
    });

    expect(cleared.code).toBeFalsy();
  });

  it('keeps the codes of a dimension whose role is taken back', async () => {
    const french = await addValue('language', {
      label: 'Français',
      code: 'fr',
    });
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(await dimensionNamed('language')),
      payload: { role: null },
    });

    const [kept] = await taxonomyService.listTaxonomyItems({
      user: adminA,
      type: 'language',
    });

    expect(idOf(kept)).toBe(idOf(french));
    expect(kept.code).toBe('fr');
  });
});
