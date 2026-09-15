'use strict';

// A taxonomy item is a per-company object holding the client's own words
// ("Infolettre", "Black Friday VIP") and its own definition of them. Leaking or
// letting someone write one across companies is a tenant boundary failure, so the
// DB mock below honours the `_company` filter exactly like MongoDB would — the
// same approach as tests/server/security/exploit-f2-idor-cross-tenant.test.js.
// A mock that ignored the filter would pass on unscoped code too.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  TaxonomyItems: {
    find: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
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
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const taxonomyService = require('../../../packages/server/taxonomy/taxonomy.service.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const COMPANY_A = '507f1f77bcf86cd799439a01';
const COMPANY_B = '507f1f77bcf86cd799439b01';

const ITEM_A = '507f1f77bcf86cd799439101';
const ITEM_B = '507f1f77bcf86cd799439102';

const userA = { isAdmin: false, isGroupAdmin: true, group: { id: COMPANY_A } };
const userB = { isAdmin: false, isGroupAdmin: true, group: { id: COMPANY_B } };
const superAdmin = { isAdmin: true };

// Seed: one item per company, both labelled "Infolettre" on purpose — the same
// label on two companies is legitimate and must stay so.
const DB = [
  {
    _id: ITEM_A,
    _company: COMPANY_A,
    type: 'emailType',
    label: 'Infolettre',
    isActive: true,
  },
  {
    _id: ITEM_B,
    _company: COMPANY_B,
    type: 'emailType',
    label: 'Infolettre',
    isActive: true,
  },
];

// `_id` may arrive as a plain id or as `{ $ne: id }` (the label-uniqueness check
// excluding the item being edited); both are honoured, so the test cannot pass on
// code that dropped the exclusion.
const matchesId = (item, idFilter) =>
  idFilter.$ne !== undefined
    ? String(item._id) !== String(idFilter.$ne)
    : String(item._id) === String(idFilter);

// The label filter arrives as a case-insensitive `$regex`, exactly as MongoDB
// would receive it; matching on equality here would let a case-sensitive
// implementation pass.
const matchesLabel = (item, labelFilter) => {
  if (labelFilter === undefined) return true;
  if (typeof labelFilter === 'object' && labelFilter.$regex) {
    return new RegExp(labelFilter.$regex, labelFilter.$options || '').test(
      item.label
    );
  }
  return item.label === labelFilter;
};

const matches = (item, query) =>
  (!query._id || matchesId(item, query._id)) &&
  (!query._company || String(item._company) === String(query._company)) &&
  (!query.type || item.type === query.type) &&
  (query.isActive === undefined || item.isActive === query.isActive) &&
  matchesLabel(item, query.label);

function dbFindOne(query) {
  return DB.find((item) => matches(item, query)) || null;
}

function asDocument(item) {
  return item && { ...item, save: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  TaxonomyItems.findOne.mockImplementation(async (query) =>
    asDocument(dbFindOne(query))
  );
  TaxonomyItems.exists.mockImplementation(async (query) =>
    Boolean(dbFindOne(query))
  );
  TaxonomyItems.find.mockImplementation(() => ({
    sort: jest.fn().mockResolvedValue([]),
  }));
  TaxonomyItems.create.mockImplementation(async (doc) => ({ ...doc }));
  TaxonomyItems.deleteOne.mockResolvedValue({ deletedCount: 1 });
  TaxonomyItems.countDocuments.mockResolvedValue(0);
  Mailings.countDocuments.mockResolvedValue(0);
});

describe('listTaxonomyItems — company scope', () => {
  it('reads only the caller company, never the whole collection', async () => {
    await taxonomyService.listTaxonomyItems({ user: userA, type: 'emailType' });

    const query = TaxonomyItems.find.mock.calls[0][0];
    expect(String(query._company)).toBe(COMPANY_A);
    expect(query.type).toBe('emailType');
  });

  it('refuses to read another company', async () => {
    await expect(
      taxonomyService.listTaxonomyItems({
        user: userA,
        groupId: COMPANY_B,
        type: 'emailType',
      })
    ).rejects.toMatchObject({ status: 403 });

    expect(TaxonomyItems.find).not.toHaveBeenCalled();
  });

  it('accepts the caller naming its own company', async () => {
    await taxonomyService.listTaxonomyItems({
      user: userA,
      groupId: COMPANY_A,
      type: 'emailType',
    });

    expect(String(TaxonomyItems.find.mock.calls[0][0]._company)).toBe(
      COMPANY_A
    );
  });

  it('lets a super admin read any company', async () => {
    await taxonomyService.listTaxonomyItems({
      user: superAdmin,
      groupId: COMPANY_B,
      type: 'emailType',
    });

    expect(String(TaxonomyItems.find.mock.calls[0][0]._company)).toBe(
      COMPANY_B
    );
  });

  it('refuses a super admin who names no company at all', async () => {
    await expect(
      taxonomyService.listTaxonomyItems({ user: superAdmin, type: 'emailType' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('filters on isActive only when asked, so the admin screen sees everything', async () => {
    await taxonomyService.listTaxonomyItems({ user: userA, type: 'emailType' });
    expect(TaxonomyItems.find.mock.calls[0][0]).not.toHaveProperty('isActive');

    await taxonomyService.listTaxonomyItems({
      user: userA,
      type: 'emailType',
      activeOnly: true,
    });
    expect(TaxonomyItems.find.mock.calls[1][0].isActive).toBe(true);
  });

  it.each([[undefined], [''], ['language'], ['../emailType'], [{}]])(
    'refuses the taxonomy type %p',
    async (type) => {
      await expect(
        taxonomyService.listTaxonomyItems({ user: userA, type })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_TAXONOMY_TYPE,
      });
    }
  );
});

describe('createTaxonomyItem', () => {
  it('stamps the caller company', async () => {
    await taxonomyService.createTaxonomyItem({
      user: userA,
      type: 'emailType',
      payload: { label: 'Black Friday' },
    });

    const created = TaxonomyItems.create.mock.calls[0][0];
    expect(String(created._company)).toBe(COMPANY_A);
    expect(created.label).toBe('Black Friday');
    expect(created.type).toBe('emailType');
  });

  // Refused rather than dropped: a payload that silently loses a field answers
  // 200 and changes nothing, which reads as a successful save.
  it.each([
    ['_company', COMPANY_B],
    ['_id', '507f1f77bcf86cd799439999'],
    ['type', 'language'],
    ['cannonicalType', 'promo'],
    ['__proto__', { polluted: true }],
  ])('refuses an unexpected %s in the payload', async (key, value) => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: JSON.parse(
          JSON.stringify({ label: 'Black Friday', [key]: value })
        ),
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });

    expect(TaxonomyItems.create).not.toHaveBeenCalled();
    expect({}.polluted).toBeUndefined();
  });

  it('refuses to create in another company', async () => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        groupId: COMPANY_B,
        type: 'emailType',
        payload: { label: 'Black Friday' },
      })
    ).rejects.toMatchObject({ status: 403 });

    expect(TaxonomyItems.create).not.toHaveBeenCalled();
  });

  it('refuses a label the company already uses', async () => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'Infolettre' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS,
    });
  });

  it('allows the same label on two companies', async () => {
    // "Infolettre" already exists on company A; company B has its own.
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userB,
        type: 'emailType',
        payload: { label: 'Soldes' },
      })
    ).resolves.toBeTruthy();

    const query = TaxonomyItems.exists.mock.calls[0][0];
    expect(String(query._company)).toBe(COMPANY_B);
  });

  it('requires a label', async () => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: {},
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL,
    });
  });

  it.each([['   '], ['']])('refuses a blank label (%p)', async (label) => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label },
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL,
    });
  });

  it('trims the label, so two labels cannot differ by whitespace alone', async () => {
    await taxonomyService.createTaxonomyItem({
      user: userA,
      type: 'emailType',
      payload: { label: '  Black Friday  ' },
    });

    expect(TaxonomyItems.create.mock.calls[0][0].label).toBe('Black Friday');
  });

  it('accepts a canonical type without constraining its value', async () => {
    await taxonomyService.createTaxonomyItem({
      user: userA,
      type: 'emailType',
      payload: { label: 'Nouveauté', canonicalType: 'not-in-the-list-yet' },
    });

    expect(TaxonomyItems.create.mock.calls[0][0].canonicalType).toBe(
      'not-in-the-list-yet'
    );
  });

  it.each([
    ['label', 42],
    ['description', 42],
    ['canonicalType', 42],
    ['isActive', 'yes'],
    ['order', 'first'],
    ['order', Infinity],
  ])('refuses a %s of the wrong type', async (field, value) => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'Valide', [field]: value },
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ['description', 'x'.repeat(2001)],
    ['canonicalType', 'x'.repeat(61)],
  ])('refuses an over-long %s', async (field, value) => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'Valide', [field]: value },
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it.each([['description'], ['canonicalType']])(
    'clears %s with an empty string, so both optional fields answer alike',
    async (field) => {
      await taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'Valide', [field]: '' },
      });

      expect(TaxonomyItems.create.mock.calls[0][0][field]).toBeUndefined();
    }
  );

  it('refuses a label that differs only by case from an existing one', async () => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'INFOLETTRE' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS,
    });
  });

  it('does not treat a regex metacharacter in the label as a pattern', async () => {
    // '.' would match any character if the label went into the regex raw, so
    // 'Infolettr.' would collide with 'Infolettre'.
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'Infolettr.' },
      })
    ).resolves.toBeTruthy();
  });

  it('turns a lost race on the unique index into a conflict, not a 500', async () => {
    TaxonomyItems.create.mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key error'), { code: 11000 })
    );

    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'Soldes' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS,
    });
  });

  it('refuses to create past the per-company cap', async () => {
    TaxonomyItems.countDocuments.mockResolvedValue(200);

    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'Une de trop' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_LIMIT_REACHED,
    });

    // Counted within the company, not across the platform.
    const query = TaxonomyItems.countDocuments.mock.calls[0][0];
    expect(String(query._company)).toBe(COMPANY_A);
    expect(query.type).toBe('emailType');
  });

  it('refuses an over-long label', async () => {
    await expect(
      taxonomyService.createTaxonomyItem({
        user: userA,
        type: 'emailType',
        payload: { label: 'x'.repeat(121) },
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });
});

describe('updateTaxonomyItem', () => {
  it('refuses to edit another company\'s item, reading it as not found', async () => {
    await expect(
      taxonomyService.updateTaxonomyItem({
        user: userA,
        itemId: ITEM_B,
        payload: { label: 'Hijacked' },
      })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.TAXONOMY_ITEM_NOT_FOUND,
    });
  });

  it('bounds the lookup by company in the same query as the id', async () => {
    await taxonomyService.updateTaxonomyItem({
      user: userA,
      itemId: ITEM_A,
      payload: { label: 'Infolettre hebdo' },
    });

    const query = TaxonomyItems.findOne.mock.calls[0][0];
    expect(String(query._company)).toBe(COMPANY_A);
  });

  it('applies only the fields the payload carries', async () => {
    const item = await taxonomyService.updateTaxonomyItem({
      user: userA,
      itemId: ITEM_A,
      payload: { description: 'Envoi hebdomadaire du jeudi' },
    });

    expect(item.description).toBe('Envoi hebdomadaire du jeudi');
    // Untouched by a payload that did not mention it.
    expect(item.label).toBe('Infolettre');
    expect(item.save).toHaveBeenCalled();
  });

  it('deactivates without deleting, so existing emails keep resolving', async () => {
    const item = await taxonomyService.updateTaxonomyItem({
      user: userA,
      itemId: ITEM_A,
      payload: { isActive: false },
    });

    expect(item.isActive).toBe(false);
    expect(TaxonomyItems.deleteOne).not.toHaveBeenCalled();
  });

  it('lets an item keep its own label', async () => {
    await expect(
      taxonomyService.updateTaxonomyItem({
        user: userA,
        itemId: ITEM_A,
        payload: { label: 'Infolettre', order: 3 },
      })
    ).resolves.toBeTruthy();
  });

  it('clears the canonical type with null', async () => {
    const item = await taxonomyService.updateTaxonomyItem({
      user: userA,
      itemId: ITEM_A,
      payload: { canonicalType: null },
    });

    expect(item.canonicalType).toBeUndefined();
  });

  it.each([[undefined], ['not-an-objectid'], ['']])(
    'reads a malformed id (%p) as not found, without querying',
    async (itemId) => {
      await expect(
        taxonomyService.updateTaxonomyItem({
          user: userA,
          itemId,
          payload: { label: 'x' },
        })
      ).rejects.toMatchObject({ status: 404 });

      expect(TaxonomyItems.findOne).not.toHaveBeenCalled();
    }
  );

  // Moving an item between taxonomies or companies would orphan the emails
  // pointing at it, so neither is editable — and the payload saying otherwise is
  // refused rather than ignored.
  it.each([
    ['_company', COMPANY_B],
    ['type', 'language'],
  ])('refuses to move the item to another %s', async (key, value) => {
    await expect(
      taxonomyService.updateTaxonomyItem({
        user: userA,
        itemId: ITEM_A,
        payload: { [key]: value },
      })
    ).rejects.toMatchObject({
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('refuses a payload that would change nothing', async () => {
    await expect(
      taxonomyService.updateTaxonomyItem({
        user: userA,
        itemId: ITEM_A,
        payload: {},
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_TAXONOMY_ITEM,
    });
  });

  it('checks label availability within the item taxonomy, excluding itself', async () => {
    await taxonomyService.updateTaxonomyItem({
      user: userA,
      itemId: ITEM_A,
      payload: { label: 'Autre libellé' },
    });

    const query = TaxonomyItems.exists.mock.calls[0][0];
    expect(String(query._company)).toBe(COMPANY_A);
    expect(query.type).toBe('emailType');
    expect(String(query._id.$ne)).toBe(ITEM_A);
  });

  it('turns a lost race on the unique index into a conflict', async () => {
    TaxonomyItems.findOne.mockImplementation(async (query) => {
      const found = dbFindOne(query);
      return (
        found && {
          ...found,
          save: jest
            .fn()
            .mockRejectedValue(
              Object.assign(new Error('E11000'), { code: 11000 })
            ),
        }
      );
    });

    await expect(
      taxonomyService.updateTaxonomyItem({
        user: userA,
        itemId: ITEM_A,
        payload: { label: 'Autre libellé' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS,
    });
  });

  it('lets a super admin edit across companies', async () => {
    await expect(
      taxonomyService.updateTaxonomyItem({
        user: superAdmin,
        itemId: ITEM_B,
        payload: { order: 2 },
      })
    ).resolves.toBeTruthy();
  });
});

describe('deleteTaxonomyItem', () => {
  it('refuses to delete another company\'s item', async () => {
    await expect(
      taxonomyService.deleteTaxonomyItem({ user: userA, itemId: ITEM_B })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.TAXONOMY_ITEM_NOT_FOUND,
    });

    expect(TaxonomyItems.deleteOne).not.toHaveBeenCalled();
  });

  it('deletes an unused item', async () => {
    await taxonomyService.deleteTaxonomyItem({ user: userA, itemId: ITEM_A });

    const query = TaxonomyItems.deleteOne.mock.calls[0][0];
    expect(String(query._id)).toBe(ITEM_A);
    // The company travels in the delete too, not only in the preceding read.
    expect(String(query._company)).toBe(COMPANY_A);
  });

  it('refuses when an email still references the item', async () => {
    Mailings.countDocuments.mockResolvedValue(12);

    await expect(
      taxonomyService.deleteTaxonomyItem({ user: userA, itemId: ITEM_A })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_ITEM_IN_USE,
      details: { usageCount: 12 },
    });

    expect(TaxonomyItems.deleteOne).not.toHaveBeenCalled();
  });

  it('counts usage within the company, not across the platform', async () => {
    await taxonomyService.deleteTaxonomyItem({ user: userA, itemId: ITEM_A });

    const query = Mailings.countDocuments.mock.calls[0][0];
    expect(String(query._company)).toBe(COMPANY_A);
    expect(String(query._emailType)).toBe(ITEM_A);
  });

  it('surfaces a delete that silently affected nothing', async () => {
    TaxonomyItems.deleteOne.mockResolvedValue({ deletedCount: 0 });

    await expect(
      taxonomyService.deleteTaxonomyItem({ user: userA, itemId: ITEM_A })
    ).rejects.toMatchObject({
      message: ERROR_CODES.FAILED_TAXONOMY_ITEM_DELETE,
    });
  });
});

describe('resolveCompanyId', () => {
  it('refuses a request with no user at all', () => {
    expect(() => taxonomyService.resolveCompanyId(null)).toThrow(
      ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION
    );
  });

  it('refuses a user without a company', () => {
    expect(() =>
      taxonomyService.resolveCompanyId({ isAdmin: false, group: {} })
    ).toThrow(ERROR_CODES.MISSING_GROUP_PARAM);
  });

  // `ObjectId.isValid` says yes to any 12-character string and reinterprets its
  // bytes, so 'companyAdmin' would become a valid id pointing at a company that
  // does not exist — and an item created there is invisible everywhere.
  it.each([['not-an-objectid'], ['companyAdmin'], ['aaaaaaaaaaaa'], [12]])(
    'refuses the malformed company id %p from a super admin',
    (groupId) => {
      expect(() =>
        taxonomyService.resolveCompanyId(superAdmin, groupId)
      ).toThrow(ERROR_CODES.INVALID_GROUP_PARAM);
    }
  );

  it('refuses a malformed company id on the session of a regular caller', () => {
    expect(() =>
      taxonomyService.resolveCompanyId({
        isAdmin: false,
        group: { id: 'companyAdmin' },
      })
    ).toThrow(ERROR_CODES.INVALID_GROUP_PARAM);
  });

  it('refuses a super admin falling back on a company of their own', () => {
    expect(() =>
      taxonomyService.resolveCompanyId({
        isAdmin: true,
        group: { id: COMPANY_A },
      })
    ).toThrow(ERROR_CODES.MISSING_GROUP_PARAM);
  });
});
