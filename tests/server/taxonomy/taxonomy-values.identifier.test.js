'use strict';

// Acceptance tests of the identifier of a value (epic #1351, ADR-0032).
//
// The identifier is what a template compares against. It is proposed from the
// label and stays editable (story 18; the impact of an edit is shown by #1555).
// Within a company dimension, two values never share one; the email type is the
// exception, because there the field maps a value onto one of the doctrine's
// types, and several values map onto the same one.

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
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');
const {
  adminA,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

beforeEach(() => resetTaxonomyModels(models));

const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: adminA, type, payload });

const edit = (value, payload) =>
  taxonomyService.updateTaxonomyItem({
    user: adminA,
    itemId: idOf(value),
    payload,
  });

describe('the identifier of a value', () => {
  beforeEach(async () => {
    await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'audience', label: 'Cible' },
    });
  });

  it('lets two email type values map onto the same doctrine type', async () => {
    await addValue('emailType', {
      label: 'Infolettre',
      canonicalType: 'editorial',
    });

    await expect(
      addValue('emailType', { label: 'Magazine', canonicalType: 'editorial' })
    ).resolves.toMatchObject({ canonicalType: 'editorial' });
  });

  it('stays editable', async () => {
    const vip = await addValue('audience', {
      label: 'Clients VIP',
      canonicalType: 'vip',
    });

    await expect(
      edit(vip, { canonicalType: 'top-clients' })
    ).resolves.toMatchObject({ canonicalType: 'top-clients' });
  });

  it('accepts an edit that sends the label and identifier back unchanged', async () => {
    const vip = await addValue('audience', {
      label: 'Clients VIP',
      canonicalType: 'vip',
    });

    await expect(
      edit(vip, {
        label: 'Clients VIP',
        canonicalType: 'vip',
        description: 'Plus de trois commandes dans l’année.',
      })
    ).resolves.toMatchObject({
      label: 'Clients VIP',
      description: 'Plus de trois commandes dans l’année.',
    });
  });

  it('accepts a label that changes only its own case', async () => {
    const vip = await addValue('audience', { label: 'Clients VIP' });

    await expect(edit(vip, { label: 'clients VIP' })).resolves.toMatchObject({
      label: 'clients VIP',
    });
  });

  it('accepts new values again once the dimension is reactivated', async () => {
    const [audience] = (
      await dimensionService.listDimensions({ user: adminA })
    ).filter((dimension) => dimension.name === 'audience');
    const toggle = (isActive) =>
      dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(audience),
        payload: { isActive },
      });

    await toggle(false);
    await expect(
      addValue('audience', { label: 'Clients VIP' })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_TYPE,
    });
    await toggle(true);

    await expect(
      addValue('audience', { label: 'Clients VIP' })
    ).resolves.toMatchObject({ label: 'Clients VIP' });
  });

  // No format is decided on the server: it trims and bounds the identifier
  // only. The screen proposes lowercase letters, digits and hyphens
  // (proposeIdentifier), but a request may store any string a template could
  // never be written against. To turn on once the format is decided.
  it.skip.each(['Clients VIP', 'clients vip', 'élite', 'vip!'])(
    'refuses %p, which is not an identifier',
    async (canonicalType) => {
      await expect(
        addValue('audience', { label: 'Clients VIP', canonicalType })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
      });
    }
  );
});
