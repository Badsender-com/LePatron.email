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

const dimensionNamed = async (name) =>
  (await dimensionService.listDimensions({ user: adminA })).find(
    (dimension) => dimension.name === name
  );

const newMailing = (overrides = {}) => ({
  _id: MAILING_ID,
  _company: COMPANY_A,
  ...overrides,
});

const companyA = { _id: COMPANY_A, emailMetadata: { enabled: true } };

// Turned on by #1355 (choose the values of company dimensions on an email)
describe.skip('what the editor receives of the company dimensions, and what follows an email', () => {
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

  describe('what the editor receives', () => {
    const build = (mailing) =>
      metadataService.buildEditorMetadata({ mailing, group: companyA });

    it('offers the active company dimensions in their declared order, with their active values', async () => {
      const { emailMetadataConfig } = await build(newMailing());

      expect(emailMetadataConfig.dimensions.map((d) => d.name)).toEqual([
        'brand',
        'audience',
      ]);
      const audience = emailMetadataConfig.dimensions[1];
      expect(audience).toMatchObject({ name: 'audience', label: 'Cible' });
      expect(audience.values.map((value) => value.label).sort()).toEqual([
        'Clients VIP',
        'Prospects',
      ]);
    });

    it('leaves the standard dimensions to their own fields', async () => {
      const { emailMetadataConfig } = await build(newMailing());

      const names = emailMetadataConfig.dimensions.map((d) => d.name);
      expect(names).not.toContain('emailType');
      expect(names).not.toContain('trigger');
    });

    it('gives the values the email carries', async () => {
      const { emailMetadata } = await build(
        newMailing({ _taxonomyItems: [vip._id] })
      );

      expect(idsOf(emailMetadata.taxonomyItemIds)).toEqual([idOf(vip)]);
    });

    it('drops a deactivated dimension, but keeps its value on the email', async () => {
      await dimensionService.updateDimension({
        user: adminA,
        dimensionId: idOf(await dimensionNamed('audience')),
        payload: { isActive: false },
      });

      const { emailMetadata, emailMetadataConfig } = await build(
        newMailing({ _taxonomyItems: [vip._id] })
      );

      expect(emailMetadataConfig.dimensions.map((d) => d.name)).toEqual([
        'brand',
      ]);
      expect(idsOf(emailMetadata.taxonomyItemIds)).toEqual([idOf(vip)]);
    });

    it('still lists a deactivated value the email carries, marked as such', async () => {
      await taxonomyService.updateTaxonomyItem({
        user: adminA,
        itemId: idOf(prospects),
        payload: { isActive: false },
      });

      const withIt = await build(
        newMailing({ _taxonomyItems: [prospects._id] })
      );
      const without = await build(newMailing());

      const offered = (result) =>
        result.emailMetadataConfig.dimensions.find((d) => d.name === 'audience')
          .values;
      expect(
        offered(withIt).find((value) => value.label === 'Prospects')
      ).toMatchObject({ isActive: false });
      expect(offered(without).map((value) => value.label)).toEqual([
        'Clients VIP',
      ]);
    });
  });

  describe('when the email changes hands', () => {
    it('drops the values when the email moves to another company', () => {
      const mailing = newMailing({
        _emailType: '507f1f77bcf86cd799439101',
        _taxonomyItems: [vip._id],
        trigger: 'automated',
      });

      metadataService.clearCompanyScopedMetadata(mailing);

      expect(mailing._taxonomyItems).toBeUndefined();
      expect(mailing._emailType).toBeUndefined();
      // The trigger is the doctrine's, not the company's: it follows the email.
      expect(mailing.trigger).toBe('automated');
    });

    it('keeps the values on a copy', () => {
      const {
        buildMailingCopy,
      } = require('../../../packages/server/mailing/mailing.service.js');

      const copy = buildMailingCopy({
        _id: MAILING_ID,
        name: 'Soldes',
        _company: COMPANY_A,
        _taxonomyItems: [vip._id, brandA._id],
      });

      expect(idsOf(copy._taxonomyItems)).toEqual([idOf(vip), idOf(brandA)]);
    });
  });
});
