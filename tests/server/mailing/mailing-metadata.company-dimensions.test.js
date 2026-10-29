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
  adminB,
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

const dimensionNamed = async (name) =>
  (await dimensionService.listDimensions({ user: adminA })).find(
    (dimension) => dimension.name === name
  );

const newMailing = (overrides = {}) => ({
  _id: MAILING_ID,
  _company: COMPANY_A,
  ...overrides,
});

// Turned on by #1355 (choose the values of company dimensions on an email)
describe.skip('an email carries company dimensions', () => {
  let vip;
  let prospects;
  let brandA;

  beforeAll(loadServices);

  beforeEach(async () => {
    await declare({ name: 'audience', label: 'Cible', order: 20 });
    await declare({ name: 'brand', label: 'Marque', order: 10 });
    vip = await addValue('audience', { label: 'Clients VIP' });
    prospects = await addValue('audience', { label: 'Prospects' });
    brandA = await addValue('brand', { label: 'Marque A' });
  });

  it('stores one value per company dimension', async () => {
    const mailing = newMailing();

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(vip), idOf(brandA)],
    });

    expect(idsOf(mailing._taxonomyItems).sort()).toEqual(
      [idOf(vip), idOf(brandA)].sort()
    );
  });

  it('replaces the values on the next save', async () => {
    const mailing = newMailing({ _taxonomyItems: [vip._id, brandA._id] });

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(prospects)],
    });

    expect(idsOf(mailing._taxonomyItems)).toEqual([idOf(prospects)]);
  });

  it.each([[[]], [null]])('clears them all with %p', async (cleared) => {
    const mailing = newMailing({ _taxonomyItems: [vip._id] });

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: cleared,
    });

    expect(mailing._taxonomyItems || []).toEqual([]);
  });

  it('leaves them alone when the request does not mention them', async () => {
    const mailing = newMailing({ _taxonomyItems: [vip._id] });

    await metadataService.applyMetadataToMailing(mailing, {
      subject: 'Soldes',
    });

    expect(idsOf(mailing._taxonomyItems)).toEqual([idOf(vip)]);
  });

  it('refuses two values of one dimension', async () => {
    await expect(
      metadataService.applyMetadataToMailing(newMailing(), {
        taxonomyItemIds: [idOf(vip), idOf(prospects)],
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it('refuses a value of another company, as if it did not exist', async () => {
    await declare({ name: 'audience', label: 'Audience' }, adminB);
    const elsewhere = await addValue('audience', { label: 'VIP' }, adminB);

    await expect(
      metadataService.applyMetadataToMailing(newMailing(), {
        taxonomyItemIds: [idOf(elsewhere)],
      })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.TAXONOMY_ITEM_NOT_FOUND,
    });
  });

  it('refuses an email type value in the list: it has its own field', async () => {
    const newsletter = await addValue('emailType', { label: 'Infolettre' });

    await expect(
      metadataService.applyMetadataToMailing(newMailing(), {
        taxonomyItemIds: [idOf(newsletter)],
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it.each(['not-an-id', 42, { $ne: null }])(
    'refuses %p as a value',
    async (raw) => {
      await expect(
        metadataService.applyMetadataToMailing(newMailing(), {
          taxonomyItemIds: [raw],
        })
      ).rejects.toMatchObject({
        status: 422,
        message: ERROR_CODES.INVALID_EMAIL_METADATA,
      });
    }
  );

  it('refuses a deactivated value newly chosen', async () => {
    await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(vip),
      payload: { isActive: false },
    });

    await expect(
      metadataService.applyMetadataToMailing(newMailing(), {
        taxonomyItemIds: [idOf(vip)],
      })
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it('keeps a deactivated value the email already carries', async () => {
    const mailing = newMailing({ _taxonomyItems: [vip._id] });
    await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(vip),
      payload: { isActive: false },
    });

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(vip), idOf(brandA)],
    });

    expect(idsOf(mailing._taxonomyItems).sort()).toEqual(
      [idOf(vip), idOf(brandA)].sort()
    );
  });

  it('keeps the value of a deactivated dimension the email already carries', async () => {
    const mailing = newMailing({ _taxonomyItems: [vip._id] });
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(await dimensionNamed('audience')),
      payload: { isActive: false },
    });

    await metadataService.applyMetadataToMailing(mailing, {
      taxonomyItemIds: [idOf(vip), idOf(brandA)],
    });

    expect(idsOf(mailing._taxonomyItems)).toContain(idOf(vip));
  });
});
