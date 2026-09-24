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
const taxonomyDefaultsService = require('../../../packages/server/taxonomy/taxonomy-defaults.service.js');
const {
  DEFAULT_EMAIL_TYPES,
  pickSeedLang,
  buildDefaultEmailTypes,
  planMissingDefaultEmailTypes,
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

// A super admin's session has no `lang`, and a super admin is who creates
// companies: reading the account alone seeded every company in English. The
// interface language is passed first for that reason.
describe('pickSeedLang', () => {
  it('prefers the interface language over the account one', () => {
    expect(pickSeedLang('fr', 'en')).toBe('fr');
  });

  it('falls back on the account when the interface sends nothing', () => {
    expect(pickSeedLang(undefined, 'fr')).toBe('fr');
  });

  it('skips a language the seed has no labels for', () => {
    expect(pickSeedLang('de', 'fr')).toBe('fr');
    expect(pickSeedLang('__proto__', 'constructor')).toBe('en');
  });

  it('seeds in English when nothing usable is given', () => {
    expect(pickSeedLang()).toBe('en');
    expect(pickSeedLang(null, undefined)).toBe('en');
  });
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
    const created = await taxonomyDefaultsService.seedDefaultEmailTypes({
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

    const created = await taxonomyDefaultsService.seedDefaultEmailTypes({
      companyId: COMPANY,
    });

    expect(created).toEqual([]);
    expect(TaxonomyItems.insertMany).not.toHaveBeenCalled();
  });

  it('counts only the emailType taxonomy of that company', async () => {
    await taxonomyDefaultsService.seedDefaultEmailTypes({ companyId: COMPANY });

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
      taxonomyDefaultsService.seedDefaultEmailTypes({ companyId: COMPANY })
    ).resolves.toEqual([]);
  });

  it('lets any other write failure through', async () => {
    TaxonomyItems.insertMany.mockRejectedValue(new Error('connection lost'));

    await expect(
      taxonomyDefaultsService.seedDefaultEmailTypes({ companyId: COMPANY })
    ).rejects.toThrow('connection lost');
  });
});

// The button an admin clicks to repair a company: one created before the seed
// existed, or one where a type was deleted by mistake. Deliberately NOT the same
// rule as the seed — which gives up the moment it finds anything — so the two
// rules are what these tests separate.
describe('planMissingDefaultEmailTypes', () => {
  const canonicalsOf = (items) => items.map((item) => item.canonicalType);

  it('proposes all six to a company with nothing', () => {
    const { toCreate, skipped } = planMissingDefaultEmailTypes([], 'fr');

    expect(canonicalsOf(toCreate)).toEqual([...EmailTypeCanonicalValues]);
    expect(skipped).toEqual([]);
  });

  // The label belongs to the company. An admin who renamed "Éditorial" to
  // "Contenu de marque" still has the editorial type, and re-creating it would be
  // the tool undoing their work.
  it('recognises a renamed type by its canonical mapping', () => {
    const { toCreate } = planMissingDefaultEmailTypes(
      [{ label: 'Contenu de marque', canonicalType: 'editorial' }],
      'fr'
    );

    expect(canonicalsOf(toCreate)).not.toContain('editorial');
    expect(toCreate).toHaveLength(5);
  });

  it('restores a single deleted type and leaves the rest alone', () => {
    const all = buildDefaultEmailTypes('fr');
    const existing = all.filter((item) => item.canonicalType !== 'service');

    const { toCreate } = planMissingDefaultEmailTypes(existing, 'fr');

    expect(canonicalsOf(toCreate)).toEqual(['service']);
  });

  it('proposes nothing to a company that has them all', () => {
    const { toCreate, skipped } = planMissingDefaultEmailTypes(
      buildDefaultEmailTypes('en'),
      'en'
    );

    expect(toCreate).toEqual([]);
    expect(skipped).toEqual([]);
  });

  // A company that mapped nothing gets everything back: that is the correct
  // reading of "this company has no Badsender type", however its items are named.
  it('ignores items carrying no canonical mapping', () => {
    const { toCreate } = planMissingDefaultEmailTypes(
      [
        { label: 'Black Friday', canonicalType: null },
        { label: 'Relance panier' },
      ],
      'fr'
    );

    expect(toCreate).toHaveLength(6);
  });

  // "Éditorial (2)" is not a thing anyone asked for. The admin who already has a
  // different "Éditorial" is better told than worked around.
  it('skips a type whose label is already taken, rather than mangling it', () => {
    const { toCreate, skipped } = planMissingDefaultEmailTypes(
      [{ label: 'Éditorial', canonicalType: null }],
      'fr'
    );

    expect(canonicalsOf(toCreate)).not.toContain('editorial');
    expect(skipped).toEqual([
      { canonicalType: 'editorial', label: 'Éditorial' },
    ]);
  });

  // Looser than the unique index on purpose: the index would happily take
  // "éditorial" beside "Éditorial", and the point is to avoid handing a company
  // two rows that read alike, not merely to avoid a write error.
  it.each([['éditorial'], ['  Éditorial  '], ['ÉDITORIAL']])(
    'treats %p as the same label',
    (label) => {
      const { skipped } = planMissingDefaultEmailTypes(
        [{ label, canonicalType: null }],
        'fr'
      );

      expect(canonicalsOf(skipped)).toEqual(['editorial']);
    }
  );

  it('keeps the doctrine order rather than appending at the end', () => {
    const all = buildDefaultEmailTypes('fr');
    const existing = all.filter((item) => item.canonicalType !== 'editorial');

    const { toCreate } = planMissingDefaultEmailTypes(existing, 'fr');

    expect(toCreate[0].order).toBe(1);
  });

  it.each([[undefined], [null], [[]]])('survives %p', (existing) => {
    expect(planMissingDefaultEmailTypes(existing, 'en').toCreate).toHaveLength(
      6
    );
  });
});

describe('addMissingDefaultEmailTypes', () => {
  const user = { isAdmin: false, isGroupAdmin: true, group: { id: COMPANY } };

  const mockExisting = (items) => {
    TaxonomyItems.find.mockReturnValue({
      select: () => ({ lean: async () => items }),
    });
  };

  beforeEach(() => {
    mockExisting([]);
  });

  it('creates what is missing, scoped to the company and the taxonomy', async () => {
    const {
      created,
    } = await taxonomyDefaultsService.addMissingDefaultEmailTypes({
      user,
      groupId: COMPANY,
      lang: 'fr',
    });

    expect(created).toHaveLength(6);
    const [items] = TaxonomyItems.insertMany.mock.calls[0];
    for (const item of items) {
      // String(): this path goes through resolveCompanyId, which hands back an
      // ObjectId rather than the string the caller passed.
      expect(String(item._company)).toBe(COMPANY);
      expect(item.type).toBe('emailType');
    }
  });

  // Unlike seedDefaultEmailTypes, which gives up here. This one is asked for
  // explicitly by someone looking at the list, so it repairs.
  it('adds the missing one to a company that already has the others', async () => {
    const all = buildDefaultEmailTypes('fr');
    mockExisting(all.filter((item) => item.canonicalType !== 'notification'));

    const {
      created,
    } = await taxonomyDefaultsService.addMissingDefaultEmailTypes({
      user,
      groupId: COMPANY,
    });

    expect(created).toHaveLength(1);
  });

  it('writes nothing when there is nothing to add', async () => {
    mockExisting(buildDefaultEmailTypes('en'));

    const {
      created,
    } = await taxonomyDefaultsService.addMissingDefaultEmailTypes({
      user,
      groupId: COMPANY,
    });

    expect(created).toEqual([]);
    expect(TaxonomyItems.insertMany).not.toHaveBeenCalled();
  });

  it('refuses to push the company past its item cap', async () => {
    mockExisting(
      Array.from({ length: TaxonomyLimits.ITEMS_PER_COMPANY }, (_, i) => ({
        label: `Typologie ${i}`,
        canonicalType: null,
      }))
    );

    await expect(
      taxonomyDefaultsService.addMissingDefaultEmailTypes({
        user,
        groupId: COMPANY,
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(TaxonomyItems.insertMany).not.toHaveBeenCalled();
  });

  // The label comparison in the plan is looser than the index, so this is the
  // narrower case it cannot see: two admins clicking the button at once.
  it('treats a duplicate-key race as nothing left to do', async () => {
    TaxonomyItems.insertMany.mockRejectedValue(
      Object.assign(new Error('E11000'), { code: 11000 })
    );

    await expect(
      taxonomyDefaultsService.addMissingDefaultEmailTypes({
        user,
        groupId: COMPANY,
      })
    ).resolves.toMatchObject({ created: [] });
  });

  // An ordered insert keeps what it wrote before the duplicate: those are reported
  // as created, otherwise the snackbar says nothing was added while some were.
  it('reports the items written before a duplicate-key race', async () => {
    const written = [{ label: 'Editorial' }, { label: 'Promotional' }];
    TaxonomyItems.insertMany.mockRejectedValue(
      Object.assign(new Error('E11000'), { code: 11000, insertedDocs: written })
    );

    await expect(
      taxonomyDefaultsService.addMissingDefaultEmailTypes({
        user,
        groupId: COMPANY,
      })
    ).resolves.toMatchObject({ created: written });
  });

  // The whole point of the company-scoped guard: a group admin naming someone
  // else's company is refused, not quietly redirected to their own.
  it('refuses a company that is not the callers own', async () => {
    await expect(
      taxonomyDefaultsService.addMissingDefaultEmailTypes({
        user,
        groupId: '507f1f77bcf86cd799439b01',
      })
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('previewMissingDefaultEmailTypes', () => {
  const user = { isAdmin: false, isGroupAdmin: true, group: { id: COMPANY } };

  it('answers what would be created, and writes nothing', async () => {
    TaxonomyItems.find.mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });

    const plan = await taxonomyDefaultsService.previewMissingDefaultEmailTypes({
      user,
      groupId: COMPANY,
      lang: 'fr',
    });

    expect(plan.toCreate).toHaveLength(6);
    expect(TaxonomyItems.insertMany).not.toHaveBeenCalled();
  });
});
