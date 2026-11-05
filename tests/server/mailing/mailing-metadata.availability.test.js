'use strict';

// Acceptance tests of an email carrying its company dimensions (epic #1351,
// ADR-0014).
//
// The email type and the trigger keep their own fields. Every company dimension
// is carried as one list of values, `taxonomyItemIds` in the request, at most one
// value per dimension, every one optional.
//
// Nothing is rewritten silently: a value the email already carries is kept when
// it is sent back unchanged, even if it has since been deactivated or is no
// longer offered under its parent value. Only the values a request changes are
// checked, so an email in progress never becomes impossible to save because of a
// setting changed elsewhere.

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
  COMPANY_A,
  adminA,
  idOf,
  idsOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const MAILING_ID = '507f1f77bcf86cd799439e01';

let dimensionService;
let taxonomyService;
let metadataService;

// Required lazily: the dimension service and the moved taxonomy service appear
// with #1353, and a top-level require would break the suite until then.
function loadServices() {
  dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
  taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');
  metadataService = require('../../../packages/server/mailing/mailing-metadata.service.js');
}

beforeEach(() => resetTaxonomyModels(models));

const declare = (payload, user = adminA) =>
  dimensionService.createDimension({ user, payload });

const addValue = (type, payload, user = adminA) =>
  taxonomyService.createTaxonomyItem({ user, type, payload });

const newMailing = (overrides = {}) => ({
  _id: MAILING_ID,
  _company: COMPANY_A,
  ...overrides,
});

const companyA = { _id: COMPANY_A, emailMetadata: { enabled: true } };

// Turned on by #1358 (nested dimensions and availability)
describe.skip('availability on an email', () => {
  let canada;
  let belgium;
  let french;
  let dutch;
  let english;

  beforeAll(loadServices);

  beforeEach(async () => {
    await declare({ name: 'market', label: 'Marché' });
    await declare({ name: 'language', label: 'Langue', parentName: 'market' });
    canada = await addValue('market', { label: 'Canada' });
    belgium = await addValue('market', { label: 'Belgique' });
    french = await addValue('language', {
      label: 'Français',
      parentIds: [idOf(canada), idOf(belgium)],
    });
    dutch = await addValue('language', {
      label: 'Néerlandais',
      parentIds: [idOf(belgium)],
    });
    // No availability: offered under every market.
    english = await addValue('language', { label: 'Anglais' });
  });

  it('accepts a value offered under the chosen parent value', async () => {
    const mailing = newMailing();

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(canada), idOf(french)],
    });

    expect(idsOf(mailing._taxonomyItems).sort()).toEqual(
      [idOf(canada), idOf(french)].sort()
    );
  });

  it('refuses a value that is not offered under the chosen parent value', async () => {
    await expect(
      metadataService.applyMetadataToMailing(newMailing(), {
        taxonomyItemIds: [idOf(canada), idOf(dutch)],
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it('refuses a child value with no parent value chosen', async () => {
    await expect(
      metadataService.applyMetadataToMailing(newMailing(), {
        taxonomyItemIds: [idOf(dutch)],
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it('accepts a value with no availability under any parent value', async () => {
    const mailing = newMailing();

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(canada), idOf(english)],
    });

    expect(idsOf(mailing._taxonomyItems)).toContain(idOf(english));
  });

  it('keeps a combination that is no longer offered when it is sent back unchanged', async () => {
    const mailing = newMailing({ _taxonomyItems: [canada._id, french._id] });
    await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(french),
      payload: { parentIds: [idOf(belgium)] },
    });

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(canada), idOf(french)],
    });

    expect(idsOf(mailing._taxonomyItems).sort()).toEqual(
      [idOf(canada), idOf(french)].sort()
    );
  });

  it('checks a value again as soon as the request changes it', async () => {
    const mailing = newMailing({ _taxonomyItems: [belgium._id, french._id] });

    await expect(
      metadataService.applyMetadataToMailing(mailing, {
        taxonomyItemIds: [idOf(canada), idOf(dutch)],
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it('offers a dimension under the email type by the email type chosen on the email', async () => {
    await declare({
      name: 'programme',
      label: 'Programme',
      parentName: 'emailType',
    });
    const promotional = await addValue('emailType', {
      label: 'Promotion',
      canonicalType: 'promotional',
    });
    const editorial = await addValue('emailType', {
      label: 'Infolettre',
      canonicalType: 'editorial',
    });
    const loyalty = await addValue('programme', {
      label: 'Fidélité',
      parentIds: [idOf(promotional)],
    });

    const promo = newMailing();
    await metadataService.applyMetadataToMailing(promo, {
      emailTypeId: idOf(promotional),
      taxonomyItemIds: [idOf(loyalty)],
    });
    expect(idsOf(promo._taxonomyItems)).toEqual([idOf(loyalty)]);

    await expect(
      metadataService.applyMetadataToMailing(newMailing(), {
        emailTypeId: idOf(editorial),
        taxonomyItemIds: [idOf(loyalty)],
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it('gives the editor the availability of each value', async () => {
    const { emailMetadataConfig } = await metadataService.buildEditorMetadata({
      mailing: newMailing(),
      group: companyA,
    });

    const language = emailMetadataConfig.dimensions.find(
      (d) => d.name === 'language'
    );
    expect(language.parentName).toBe('market');
    const offered = Object.fromEntries(
      language.values.map((value) => [value.label, idsOf(value.parentIds)])
    );
    expect(offered['Néerlandais']).toEqual([idOf(belgium)]);
    expect(offered.Anglais).toEqual([]);
  });
});
