'use strict';

// Acceptance tests of the governance context of an email (epic #1351).
//
// What an AI writing assistant needs to know about one email: every active
// dimension, standard ones included, with what the dimension means and what the
// chosen value means, in the words the company's admin wrote. The text form is
// what goes into a prompt, unchanged.
//
// The email trigger's definitions belong to the doctrine, not to a company: they
// are served in the reader's language.

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
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

// Turned on by #1356 (the governance context of an email, for the AI)
describe.skip('governance context of an email', () => {
  let dimensionService;
  let taxonomyService;
  let buildGovernanceContext;
  let newsletter;
  let vip;
  let brandA;

  beforeAll(() => {
    // Required here, not at the top of the file: these modules don't exist
    // until #1353 and #1356 ship them.
    dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
    taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');
    ({
      buildGovernanceContext,
    } = require('../../../packages/server/taxonomy/services/governance-context.service.js'));
  });

  beforeEach(async () => {
    resetTaxonomyModels(models);
    await dimensionService.createDimension({
      user: adminA,
      payload: {
        name: 'brand',
        label: 'Marque',
        description: 'L’entité qui prend la parole.',
        order: 10,
      },
    });
    await dimensionService.createDimension({
      user: adminA,
      payload: {
        name: 'audience',
        label: 'Cible',
        description: 'À qui l’email s’adresse.',
        order: 20,
      },
    });
    newsletter = await taxonomyService.createTaxonomyItem({
      user: adminA,
      type: 'emailType',
      payload: {
        label: 'Infolettre',
        canonicalType: 'editorial',
        description: 'Le rendez-vous mensuel des abonnés.',
      },
    });
    vip = await taxonomyService.createTaxonomyItem({
      user: adminA,
      type: 'audience',
      payload: {
        label: 'Clients VIP',
        canonicalType: 'vip',
        description: 'Plus de trois commandes dans l’année. On les tutoie.',
      },
    });
    brandA = await taxonomyService.createTaxonomyItem({
      user: adminA,
      type: 'brand',
      payload: { label: 'Marque A', description: 'Ton direct et chaleureux.' },
    });
  });

  const fullEmail = () => ({
    _company: COMPANY_A,
    _emailType: newsletter._id,
    trigger: 'automated',
    _taxonomyItems: [vip._id, brandA._id],
  });

  const dimensionNamed = (context, name) =>
    context.dimensions.find((dimension) => dimension.name === name);

  it('gives every dimension of the email, standard ones first, then in the declared order', async () => {
    const context = await buildGovernanceContext({
      mailing: fullEmail(),
      lang: 'fr',
    });

    expect(context.dimensions.map((dimension) => dimension.name)).toEqual([
      'emailType',
      'trigger',
      'brand',
      'audience',
    ]);
    expect(context.missing).toEqual([]);
  });

  it("carries the admin's own words for the dimension and for the value", async () => {
    const context = await buildGovernanceContext({
      mailing: fullEmail(),
      lang: 'fr',
    });

    expect(dimensionNamed(context, 'audience')).toMatchObject({
      label: 'Cible',
      description: 'À qui l’email s’adresse.',
      value: {
        label: 'Clients VIP',
        identifier: 'vip',
        description: 'Plus de trois commandes dans l’année. On les tutoie.',
      },
    });
    expect(dimensionNamed(context, 'emailType').value).toMatchObject({
      label: 'Infolettre',
      identifier: 'editorial',
      description: 'Le rendez-vous mensuel des abonnés.',
    });
  });

  it.each([
    ['fr', 'Automatisé'],
    ['en', 'Automated'],
  ])(
    'gives the trigger in the doctrine’s words, in %s',
    async (lang, label) => {
      const context = await buildGovernanceContext({
        mailing: fullEmail(),
        lang,
      });

      const trigger = dimensionNamed(context, 'trigger');
      expect(trigger.value).toMatchObject({
        label,
        identifier: 'automated',
      });
      expect(trigger.value.description).toBeTruthy();
    }
  );

  it('reports a dimension the email has no value for as missing', async () => {
    const context = await buildGovernanceContext({
      mailing: { ...fullEmail(), _taxonomyItems: [brandA._id] },
      lang: 'fr',
    });

    expect(dimensionNamed(context, 'audience')).toBeUndefined();
    expect(context.missing).toEqual(['audience']);
  });

  it('leaves a deactivated dimension out entirely, even when the email has its value', async () => {
    const audience = (
      await dimensionService.listDimensions({ user: adminA })
    ).find((dimension) => dimension.name === 'audience');
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(audience),
      payload: { isActive: false },
    });

    const context = await buildGovernanceContext({
      mailing: fullEmail(),
      lang: 'fr',
    });

    expect(dimensionNamed(context, 'audience')).toBeUndefined();
    expect(context.missing).not.toContain('audience');
  });

  it('writes one section per dimension in the text given to the AI', async () => {
    const { text } = await buildGovernanceContext({
      mailing: fullEmail(),
      lang: 'fr',
    });

    expect(text).toContain('Cible');
    expect(text).toContain('Clients VIP');
    expect(text).toContain(
      'Plus de trois commandes dans l’année. On les tutoie.'
    );
    expect(text).toContain('Marque A');
    expect(text).toContain('Infolettre');
    expect(text.indexOf('Marque A')).toBeLessThan(text.indexOf('Clients VIP'));
  });

  it('gives an empty text for an email with no value at all', async () => {
    const context = await buildGovernanceContext({
      mailing: { _company: COMPANY_A },
      lang: 'fr',
    });

    expect(context.dimensions).toEqual([]);
    expect(context.text).toBe('');
  });

  it('never reads a value of another company the email would point at', async () => {
    models.TaxonomyItems.seed([
      {
        _company: '507f1f77bcf86cd799439b01',
        type: 'audience',
        label: 'Ailleurs',
      },
    ]);
    const elsewhere = models.TaxonomyItems.all().find(
      (item) => item.label === 'Ailleurs'
    );

    const context = await buildGovernanceContext({
      mailing: { _company: COMPANY_A, _taxonomyItems: [elsewhere._id] },
      lang: 'fr',
    });

    expect(JSON.stringify(context)).not.toContain('Ailleurs');
  });
});

// Turned on by #1356 (the governance context of an email, for the AI)
describe.skip('governance context route', () => {
  it('serves the context of an email to a signed-in user of its company', () => {
    const { routeInspector } = require('../../helpers/express-router.js');
    const router = require('../../../packages/server/mailing/mailing.routes.js');

    const { layerFor } = routeInspector(router);

    // The mailing router guards every route with GUARD_USER and the email
    // builder access; the controller scopes the email to the user's company.
    expect(() =>
      layerFor('get', '/:mailingId/governance-context')
    ).not.toThrow();
  });
});
