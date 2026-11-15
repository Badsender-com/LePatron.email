'use strict';

// Changing the identifier of a value emails carry (epic #1547, ADR-0026). The
// identifier is what a template compares (`market eq 'be'`), so the change is
// shown with its impact first, and applied only once confirmed. Nothing is
// rewritten in bulk: an email keeps the value, and its content takes the new
// identifier the next time it is opened in the editor.

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
  COMPANY_B,
  techAdminA,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');
const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const taxonomyService = require('../../../packages/server/taxonomy/services/taxonomy.service.js');

const NEWSLETTER = '507f1f77bcf86cd799439f01';
const TRANSACTIONAL = '507f1f77bcf86cd799439f02';
const FRANCE_ONLY = '507f1f77bcf86cd799439f03';
const OTHER_COMPANY = '507f1f77bcf86cd799439f04';
const email = (n) => `507f1f77bcf86cd7994390${String(n).padStart(2, '0')}`;

const addValue = (type, payload) =>
  taxonomyService.createTaxonomyItem({ user: techAdminA, type, payload });

let belgium;
let france;

beforeEach(async () => {
  resetTaxonomyModels(models);
  models.Templates.reset();
  await dimensionService.createDimension({
    user: techAdminA,
    payload: { name: 'market', label: 'Marché' },
  });
  await dimensionService.createDimension({
    user: techAdminA,
    payload: { name: 'language', label: 'Langue' },
  });
  belgium = await addValue('market', {
    label: 'Belgique',
    canonicalType: 'be',
  });
  france = await addValue('market', { label: 'France', canonicalType: 'fr' });

  models.Templates.seed([
    {
      _id: NEWSLETTER,
      _company: COMPANY_A,
      name: 'Newsletter v4',
      markup: `
        <p data-ko-display="_root_.market eq 'be'">Belgique</p>
        <p data-ko-display="_root_.market eq 'be' or _root_.market eq 'fr'">Francophone</p>
        <p data-ko-display="_root_.market neq 'be'">Ailleurs</p>
        <p data-ko-display="_root_.language eq 'be'">Not a market</p>`,
    },
    {
      _id: TRANSACTIONAL,
      _company: COMPANY_A,
      name: 'Transactionnel',
      markup: '<p data-ko-display="_root_.market eq \'be\'">Belgique</p>',
    },
    {
      _id: FRANCE_ONLY,
      _company: COMPANY_A,
      name: 'France seulement',
      markup: '<p data-ko-display="_root_.market eq \'fr\'">France</p>',
    },
    {
      _id: OTHER_COMPANY,
      _company: COMPANY_B,
      name: 'Elsewhere',
      markup: '<p data-ko-display="_root_.market eq \'be\'">Belgique</p>',
    },
  ]);

  const carrying = (n, values, data = {}) => ({
    _id: email(n),
    name: `Email ${n}`,
    _company: COMPANY_A,
    _wireframe: NEWSLETTER,
    _taxonomyItems: values.map(idOf),
    data: { type: 'template', ...data },
  });
  models.Mailings.seed([
    carrying(1, [belgium], { market: 'be' }),
    carrying(2, [belgium], { market: 'be' }),
    carrying(3, [belgium], { market: 'be' }),
    carrying(4, [france], { market: 'fr' }),
  ]);
});

describe('identifier change: impact and confirmation', () => {
  const impactOf = (value) =>
    taxonomyService.identifierImpact({
      user: techAdminA,
      itemId: idOf(value),
    });

  const update = (value, payload) =>
    taxonomyService.updateTaxonomyItem({
      user: techAdminA,
      itemId: idOf(value),
      payload,
    });

  it('counts the emails carrying the value, and the templates comparing the old identifier', async () => {
    expect(await impactOf(belgium)).toEqual({
      emails: 3,
      templates: [
        { id: NEWSLETTER, name: 'Newsletter v4', comparisons: 3 },
        { id: TRANSACTIONAL, name: 'Transactionnel', comparisons: 1 },
      ],
    });
  });

  it("leaves out another company's templates", async () => {
    const impact = await impactOf(belgium);

    expect(impact.templates.map((t) => t.id)).not.toContain(OTHER_COMPANY);
  });

  it('refuses to change the identifier of a carried value without the confirmation', async () => {
    await expect(
      update(belgium, { canonicalType: 'belgique' })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_IDENTIFIER_CHANGE_UNCONFIRMED,
    });

    const [stored] = await models.TaxonomyItems.find({ _id: idOf(belgium) });
    expect(stored.canonicalType).toBe('be');
  });

  it('changes it once confirmed, and rewrites no email', async () => {
    const updated = await update(belgium, {
      canonicalType: 'belgique',
      confirmIdentifierChange: true,
    });

    expect(updated.canonicalType).toBe('belgique');
    const [first] = await models.Mailings.find({ _id: email(1) });
    expect(first._taxonomyItems.map(String)).toEqual([idOf(belgium)]);
    expect(first.data.market).toBe('be');
  });

  // `_root_.language eq 'be'` in the Newsletter compares another dimension:
  // the count above leaves it out.

  it('refuses to change the identifier of a value no email carries but a template compares, without the confirmation', async () => {
    // Once its only email is gone, nothing carries France: two templates
    // still compare `fr`.
    await models.Mailings.deleteMany({ _id: email(4) });

    await expect(
      update(france, { canonicalType: 'fra' })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_IDENTIFIER_CHANGE_UNCONFIRMED,
      details: { emails: 0, templates: 2 },
    });
  });

  it('changes the identifier of a value nothing carries nor compares without asking', async () => {
    const luxembourg = await addValue('market', {
      label: 'Luxembourg',
      canonicalType: 'lux',
    });

    await expect(
      update(luxembourg, { canonicalType: 'lu' })
    ).resolves.toMatchObject({
      canonicalType: 'lu',
    });
  });

  it('asks nothing to change the label of a carried value', async () => {
    await expect(
      update(belgium, { label: 'Belgique (BE)' })
    ).resolves.toMatchObject({ label: 'Belgique (BE)', canonicalType: 'be' });
  });

  it('still refuses an identifier another value of the dimension holds', async () => {
    await expect(
      update(belgium, { canonicalType: 'fr', confirmIdentifierChange: true })
    ).rejects.toMatchObject({
      message: ERROR_CODES.TAXONOMY_ITEM_IDENTIFIER_ALREADY_EXISTS,
    });
  });
});
