'use strict';

// Acceptance tests of the values of a dimension (epic #1351, ADR-0032).
//
// A value is one of the possibilities of a dimension: Canada, French, Newsletter.
// Nothing is ever rewritten silently: deleting a value something still depends on
// is refused, and the refusal says how many things depend on it.
//
// The dimensions are set up through their own service, so these tests only rely
// on public interfaces; the collections are in-memory fakes that interpret
// queries like MongoDB.

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
  adminB,
  idOf,
  plainTokens,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const DIMENSION_SERVICE =
  '../../../packages/server/taxonomy/services/dimension.service.js';
const TAXONOMY_SERVICE =
  '../../../packages/server/taxonomy/services/taxonomy.service.js';

let dimensionService;
let taxonomyService;

// Required lazily: both modules move or appear with #1353, and a top-level
// require would break the suite until then.
function loadServices() {
  dimensionService = require(DIMENSION_SERVICE);
  taxonomyService = require(TAXONOMY_SERVICE);
}

beforeEach(() => resetTaxonomyModels(models));

const declare = (payload, user = adminA) =>
  dimensionService.createDimension({ user, payload });

const addValue = (type, payload, user = adminA) =>
  taxonomyService.createTaxonomyItem({ user, type, payload });

// Turned on by #1359 (design tokens and precedence)
describe('design tokens', () => {
  beforeAll(loadServices);

  beforeEach(async () => {
    await declare({ name: 'brand', label: 'Marque' });
  });

  it('gives a value its design tokens', async () => {
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845', textColorVar: '#1a1a1a' },
    });

    expect(plainTokens(brand.tokens)).toEqual({
      mainColorVar: '#ffd845',
      textColorVar: '#1a1a1a',
    });
  });

  // A value pasted with a line break at its end is trimmed, not refused: only a
  // control character inside it could split a link's scheme.
  it('trims a value pasted with a line break at its end', async () => {
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845\n' },
    });

    expect(plainTokens(brand.tokens)).toEqual({ mainColorVar: '#ffd845' });
  });

  it('replaces the tokens of a value on edit', async () => {
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845' },
    });

    const edited = await taxonomyService.updateTaxonomyItem({
      user: adminA,
      itemId: idOf(brand),
      payload: { tokens: { accentColorVar: '#0050ff' } },
    });

    expect(plainTokens(edited.tokens)).toEqual({ accentColorVar: '#0050ff' });
  });

  it('refuses the 25th token of a value, naming the limit', async () => {
    const tokens = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`color${i}`, '#000000'])
    );

    await expect(
      addValue('brand', { label: 'Marque A', tokens })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_LIMIT_REACHED,
      details: { limit: 24 },
    });
  });

  it.each(['type', 'theme', 'mainBlocks', 'customStyle', 'constructor'])(
    'refuses a token named %p, which publishing would write over the content',
    async (name) => {
      await expect(
        addValue('brand', { label: 'Marque A', tokens: { [name]: '#000' } })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
      });
    }
  );

  // The editor never lets a token shadow a dimension: accepted, it would be
  // ignored without a word.
  it.each([
    ['a dimension the company declared', 'brand'],
    ['the email type', 'emailType'],
    ['the trigger', 'trigger'],
  ])('refuses a token named like %s, naming it', async (kind, name) => {
    await expect(
      addValue('brand', { label: 'Marque A', tokens: { [name]: '#000' } })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_TOKEN_NAME_IS_DIMENSION,
      details: { name },
    });
  });

  it('refuses a token named like a deactivated dimension, which may come back', async () => {
    const audience = await declare({ name: 'audience', label: 'Audience' });
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(audience),
      payload: { isActive: false },
    });

    await expect(
      addValue('brand', { label: 'Marque A', tokens: { audience: '#000' } })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_TOKEN_NAME_IS_DIMENSION,
    });
  });

  // The reverse: a dimension declared under a token's name would turn the
  // token off without a word.
  it('refuses a dimension named like a token a value carries, naming it', async () => {
    await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845' },
    });

    await expect(
      declare({ name: 'mainColorVar', label: 'Couleur' })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_NAME_IS_TOKEN,
      details: { name: 'mainColorVar' },
    });
  });

  it("declares a dimension named like a token of another company's value", async () => {
    await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845' },
    });

    await expect(
      declare({ name: 'mainColorVar', label: 'Couleur' }, adminB)
    ).resolves.toMatchObject({ name: 'mainColorVar' });
  });

  it('refuses it on edit too', async () => {
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: '#ffd845' },
    });

    await expect(
      taxonomyService.updateTaxonomyItem({
        user: adminA,
        itemId: idOf(brand),
        payload: { tokens: { brand: '#000' } },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_TOKEN_NAME_IS_DIMENSION,
    });
  });

  it('accepts a token named like a dimension of another company', async () => {
    await declare({ name: 'market', label: 'Marché' }, adminB);

    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { market: '#000' },
    });

    expect(plainTokens(brand.tokens)).toEqual({ market: '#000' });
  });

  it("refuses a token named `locale`, reserved for the email's language", async () => {
    await expect(
      addValue('brand', { label: 'Marque A', tokens: { locale: 'fr' } })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('accepts a token name as long as a dimension name may be', async () => {
    const name = `a${'b'.repeat(59)}`;
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { [name]: '#000' },
    });

    expect(plainTokens(brand.tokens)).toEqual({ [name]: '#000' });
  });

  it('refuses a token name longer than a dimension name may be', async () => {
    await expect(
      addValue('brand', {
        label: 'Marque A',
        tokens: { [`a${'b'.repeat(60)}`]: '#000' },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it.each(['main-color', '1color', 'main color'])(
    'refuses a token named %p, which no template could read',
    async (name) => {
      await expect(
        addValue('brand', { label: 'Marque A', tokens: { [name]: '#000' } })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
      });
    }
  );
});

// A token ends up in the email's content, inside a style or an attribute: it
// holds a value, never markup or a block of CSS that would close it.
describe('what a token may hold', () => {
  beforeAll(loadServices);

  beforeEach(async () => {
    await declare({ name: 'brand', label: 'Marque' });
  });

  it.each([
    ['a colour', '#ffd845'],
    ['a font stack', "'Helvetica Neue', Arial, sans-serif"],
    ['a size', '16px'],
    ['a link', 'https://example.com/logo.png?w=200&h=80'],
  ])('accepts %s', async (kind, value) => {
    const brand = await addValue('brand', {
      label: 'Marque A',
      tokens: { mainColorVar: value },
    });

    expect(plainTokens(brand.tokens).mainColorVar).toBe(value);
  });

  it.each([
    ['a block of CSS', 'red} body{display:none'],
    ['a declaration', 'red; background: black'],
    ['the end of a style', '</style><script>x()</script>'],
    ['an escape', 'red\\3b'],
    ['a script link', 'javascript:alert(1)'],
    ['a script link in capitals', 'JavaScript:alert(1)'],
    ['a VBScript link', 'vbscript:msgbox(1)'],
    ['a CSS expression', 'expression(alert(1))'],
    ['an import', '@import "https://example.com/x.css"'],
    ['a CSS url', 'url(https://example.com/x.png)'],
    // A browser drops a tab or a newline inside a link's scheme.
    ['a script link split by a tab', 'java\tscript:alert(1)'],
    ['a script link split by a newline', 'java\nscript:alert(1)'],
    ['a CSS comment', 'a/*b'],
  ])('refuses %s', async (kind, value) => {
    await expect(
      addValue('brand', { label: 'Marque A', tokens: { mainColorVar: value } })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });
});
