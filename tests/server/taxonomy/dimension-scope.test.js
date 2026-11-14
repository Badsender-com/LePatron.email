'use strict';

// Acceptance tests of the scope of a dimension (epic #1514, ADR-0024): offered on
// every email, or only on the emails whose template reads it. The standard
// dimensions and a dimension holding a role are always offered on every email.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const models = require('../../../packages/server/common/models.common.js');
const {
  adminA,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');

const declare = (payload) =>
  dimensionService.createDimension({ user: adminA, payload });
const update = (dimension, payload) =>
  dimensionService.updateDimension({
    user: adminA,
    dimensionId: idOf(dimension),
    payload,
  });
const dimensionNamed = async (name) =>
  (await dimensionService.listDimensions({ user: adminA })).find(
    (dimension) => dimension.name === name
  );

beforeEach(() => resetTaxonomyModels(models));

// Turned on by #1521 (a dimension has a scope)
describe('dimension scope', () => {
  it('declares a dimension offered on every email unless told otherwise', async () => {
    const audience = await declare({ name: 'audience', label: 'Cible' });

    expect(audience.scope).toBe('all');
  });

  it('restricts a rendering dimension to the templates reading it, and back', async () => {
    const silo = await declare({ name: 'silo', label: 'Silo' });

    expect((await update(silo, { scope: 'readingTemplates' })).scope).toBe(
      'readingTemplates'
    );
    expect((await update(silo, { scope: 'all' })).scope).toBe('all');
  });

  it('declares a dimension with its scope at once', async () => {
    const silo = await declare({
      name: 'silo',
      label: 'Silo',
      scope: 'readingTemplates',
    });

    expect((await dimensionNamed('silo')).scope).toBe('readingTemplates');
    expect(silo.scope).toBe('readingTemplates');
  });

  it('refuses a scope it does not know', async () => {
    const silo = await declare({ name: 'silo', label: 'Silo' });

    await expect(
      update(silo, { scope: 'someTemplates' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('keeps a dimension holding a role on every email', async () => {
    const language = await declare({
      name: 'language',
      label: 'Langue',
      role: 'language',
    });

    await expect(
      update(language, { scope: 'readingTemplates' })
    ).rejects.toMatchObject({
      status: 409,
      message: 'DIMENSION_SCOPE_FIXED',
    });
  });

  it('refuses a role to a dimension restricted to the templates reading it', async () => {
    const market = await declare({
      name: 'market',
      label: 'Marché',
      scope: 'readingTemplates',
    });

    await expect(update(market, { role: 'country' })).rejects.toMatchObject({
      status: 409,
      message: 'DIMENSION_SCOPE_FIXED',
    });
  });

  it.each(['emailType', 'trigger'])(
    'keeps the standard dimension %s on every email',
    async (name) => {
      // Listing seeds the standard dimensions of a company that has none.
      const standard = await dimensionNamed(name);

      expect(standard.scope).toBe('all');
      await expect(
        update(standard, { scope: 'readingTemplates' })
      ).rejects.toMatchObject({ status: 409 });
    }
  );
});
