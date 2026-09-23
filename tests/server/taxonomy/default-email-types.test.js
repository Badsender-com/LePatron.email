'use strict';

// The seed is the first thing a new company sees of the taxonomy, and it runs
// exactly once per company — so the two properties worth pinning are that it
// creates the right six, and that it never runs twice. Everything else about a
// taxonomy item is covered by taxonomy.service.test.js.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  TaxonomyItems: {
    countDocuments: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  },
  Mailings: { countDocuments: jest.fn() },
  Groups: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  TaxonomyItems,
} = require('../../../packages/server/common/models.common.js');
const taxonomyService = require('../../../packages/server/taxonomy/taxonomy.service.js');
const {
  DEFAULT_EMAIL_TYPES,
  buildDefaultEmailTypes,
} = require('../../../packages/server/taxonomy/default-email-types.js');
const {
  EmailTypeCanonicalValues,
} = require('../../../packages/server/constant/email-type-canonical.js');
const {
  TaxonomyLimits,
} = require('../../../packages/server/constant/taxonomy-type.js');

const COMPANY = '507f1f77bcf86cd799439a01';

beforeEach(() => {
  jest.clearAllMocks();
  TaxonomyItems.countDocuments.mockResolvedValue(0);
  TaxonomyItems.insertMany.mockImplementation(async (items) => items);
});

describe('buildDefaultEmailTypes', () => {
  it('returns the six doctrine types, ordered 1 to 6', () => {
    const items = buildDefaultEmailTypes('fr');

    expect(items).toHaveLength(6);
    expect(items.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('maps every item onto a canonical type the vocabulary knows', () => {
    const canonicals = buildDefaultEmailTypes('en').map(
      (item) => item.canonicalType
    );

    expect([...canonicals].sort()).toEqual(
      [...EmailTypeCanonicalValues].sort()
    );
  });

  it('speaks French or English', () => {
    expect(buildDefaultEmailTypes('fr')[0].label).toBe('Éditorial');
    expect(buildDefaultEmailTypes('en')[0].label).toBe('Editorial');
  });

  // `en` because that is `User.lang`'s own default: a company created by a user
  // whose language was never set gets the same thing as one created by an English
  // speaker, rather than a half-French list.
  it.each([['de'], ['fr-BE'], [''], [null], [undefined]])(
    'falls back to English for %p',
    (lang) => {
      expect(buildDefaultEmailTypes(lang)[0].label).toBe('Editorial');
    }
  );

  // The label and description are stored, so they are bounded by the same limits
  // the form enforces — a seed the admin cannot then edit would be absurd.
  it.each(['fr', 'en'])('stays within the field limits in %s', (lang) => {
    for (const item of buildDefaultEmailTypes(lang)) {
      expect(item.label.length).toBeLessThanOrEqual(TaxonomyLimits.LABEL);
      expect(item.description.length).toBeLessThanOrEqual(
        TaxonomyLimits.DESCRIPTION
      );
      expect(item.canonicalType.length).toBeLessThanOrEqual(
        TaxonomyLimits.CANONICAL_TYPE
      );
    }
  });

  it('gives every type a label and a definition in both languages', () => {
    for (const item of DEFAULT_EMAIL_TYPES) {
      for (const lang of ['fr', 'en']) {
        expect(item[lang].label.length).toBeGreaterThan(0);
        expect(item[lang].description.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns a fresh array the caller may mutate', () => {
    const first = buildDefaultEmailTypes('fr');
    first[0].label = 'mutated';

    expect(buildDefaultEmailTypes('fr')[0].label).toBe('Éditorial');
  });
});

describe('seedDefaultEmailTypes', () => {
  it('creates the six types, scoped to the company and the emailType taxonomy', async () => {
    const created = await taxonomyService.seedDefaultEmailTypes({
      companyId: COMPANY,
      lang: 'fr',
    });

    expect(created).toHaveLength(6);
    const [items] = TaxonomyItems.insertMany.mock.calls[0];
    expect(items).toHaveLength(6);
    for (const item of items) {
      expect(item._company).toBe(COMPANY);
      expect(item.type).toBe('emailType');
    }
    expect(items.map((item) => item.label)).toEqual([
      'Éditorial',
      'Promotionnel',
      'Serviciel',
      'Suivi',
      'Transactionnel',
      'Institutionnel',
    ]);
  });

  // The company has started its own vocabulary. Topping the list up would
  // resurrect items an admin deleted on purpose, and could collide with the unique
  // index on {_company, type, label} — a renamed "Éditorial" leaves the label free.
  it('leaves a company that already has one email type alone', async () => {
    TaxonomyItems.countDocuments.mockResolvedValue(1);

    const created = await taxonomyService.seedDefaultEmailTypes({
      companyId: COMPANY,
    });

    expect(created).toEqual([]);
    expect(TaxonomyItems.insertMany).not.toHaveBeenCalled();
  });

  it('counts only the emailType taxonomy of that company', async () => {
    await taxonomyService.seedDefaultEmailTypes({ companyId: COMPANY });

    expect(TaxonomyItems.countDocuments).toHaveBeenCalledWith({
      _company: COMPANY,
      type: 'emailType',
    });
  });

  // Two creations racing on a brand-new company. The unique index decides; the
  // loser has nothing left to do, and must not surface a raw Mongo error.
  it('treats a duplicate-key race as already seeded', async () => {
    const duplicate = Object.assign(new Error('E11000'), { code: 11000 });
    TaxonomyItems.insertMany.mockRejectedValue(duplicate);

    await expect(
      taxonomyService.seedDefaultEmailTypes({ companyId: COMPANY })
    ).resolves.toEqual([]);
  });

  it('lets any other write failure through', async () => {
    TaxonomyItems.insertMany.mockRejectedValue(new Error('connection lost'));

    await expect(
      taxonomyService.seedDefaultEmailTypes({ companyId: COMPANY })
    ).rejects.toThrow('connection lost');
  });
});
