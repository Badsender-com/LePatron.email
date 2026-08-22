'use strict';

// Validation of the editorial metadata (subject, planned send date, typology).
//
// The `_emailType` reference is the sensitive part: it points at a TaxonomyItem,
// which is a per-company object. A caller who can guess an id of another company
// must not be able to attach it, so the lookup is scoped by `_company` AND by
// taxonomy `type`. The DB mock below honours both filters exactly like MongoDB
// would (same approach as tests/server/security/exploit-f2-idor-cross-tenant),
// otherwise the test would pass on unscoped code too.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  TaxonomyItems: { findOne: jest.fn() },
  Mailings: {},
  Groups: {},
}));

const mongoose = require('mongoose');
const {
  TaxonomyItems,
} = require('../../../packages/server/common/models.common.js');
const {
  validateMetadataPayload,
  applyMetadataToMailing,
} = require('../../../packages/server/mailing/mailing-metadata.service.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const COMPANY_A = '507f1f77bcf86cd799439a01';
const COMPANY_B = '507f1f77bcf86cd799439b01';

const TYPE_A = '507f1f77bcf86cd799439101'; // emailType of company A
const TYPE_B = '507f1f77bcf86cd799439102'; // emailType of company B
const LANG_A = '507f1f77bcf86cd799439103'; // company A, but another taxonomy
const UNKNOWN_ID = '507f1f77bcf86cd7994399ff';

const DB = [
  { _id: TYPE_A, _company: COMPANY_A, type: 'emailType', label: 'Infolettre' },
  { _id: TYPE_B, _company: COMPANY_B, type: 'emailType', label: 'Newsletter' },
  { _id: LANG_A, _company: COMPANY_A, type: 'language', label: 'fr' },
];

function dbFindOne(query) {
  const id = query._id ? String(query._id) : null;
  const company = query._company ? String(query._company) : null;
  const type = query.type || null;
  return (
    DB.find(
      (item) =>
        (!id || String(item._id) === id) &&
        (!company || String(item._company) === company) &&
        (!type || item.type === type)
    ) || null
  );
}

beforeEach(() => {
  TaxonomyItems.findOne.mockReset();
  TaxonomyItems.findOne.mockImplementation(async (query) => dbFindOne(query));
});

describe('validateMetadataPayload — omitted vs cleared', () => {
  it('returns nothing for an empty payload, so a PATCH never clears untouched fields', async () => {
    await expect(
      validateMetadataPayload({}, { companyId: COMPANY_A })
    ).resolves.toEqual({});
    await expect(
      validateMetadataPayload(undefined, { companyId: COMPANY_A })
    ).resolves.toEqual({});
  });

  it('distinguishes an omitted field from an explicit null', async () => {
    const omitted = await validateMetadataPayload(
      { subject: 'hello' },
      { companyId: COMPANY_A }
    );
    expect('plannedSendDate' in omitted).toBe(false);

    const cleared = await validateMetadataPayload(
      { plannedSendDate: null },
      { companyId: COMPANY_A }
    );
    expect('plannedSendDate' in cleared).toBe(true);
    expect(cleared.plannedSendDate).toBeUndefined();
  });
});

describe('validateMetadataPayload — subject', () => {
  it('trims the subject', async () => {
    const result = await validateMetadataPayload(
      { subject: '  Soldes d’été  ' },
      { companyId: COMPANY_A }
    );
    expect(result.subject).toBe('Soldes d’été');
  });

  it('clears the subject with null', async () => {
    const result = await validateMetadataPayload(
      { subject: null },
      { companyId: COMPANY_A }
    );
    expect('subject' in result).toBe(true);
    expect(result.subject).toBeUndefined();
  });

  it.each([[42], [{}], [[]], [true]])(
    'refuses a non-string subject (%p)',
    async (subject) => {
      await expect(
        validateMetadataPayload({ subject }, { companyId: COMPANY_A })
      ).rejects.toMatchObject({
        status: 422,
        message: ERROR_CODES.INVALID_EMAIL_METADATA,
      });
    }
  );
});

describe('validateMetadataPayload — plannedSendDate', () => {
  it('accepts an ISO date', async () => {
    const result = await validateMetadataPayload(
      { plannedSendDate: '2026-09-01T08:00:00.000Z' },
      { companyId: COMPANY_A }
    );
    expect(result.plannedSendDate.toISOString()).toBe(
      '2026-09-01T08:00:00.000Z'
    );
  });

  it.each([['not a date'], ['2026-13-45'], [{}]])(
    'refuses an invalid date (%p)',
    async (plannedSendDate) => {
      await expect(
        validateMetadataPayload({ plannedSendDate }, { companyId: COMPANY_A })
      ).rejects.toMatchObject({
        status: 422,
        message: ERROR_CODES.INVALID_EMAIL_METADATA,
      });
    }
  );

  it.each([[null], ['']])(
    'clears the date with %p',
    async (plannedSendDate) => {
      const result = await validateMetadataPayload(
        { plannedSendDate },
        { companyId: COMPANY_A }
      );
      expect('plannedSendDate' in result).toBe(true);
      expect(result.plannedSendDate).toBeUndefined();
    }
  );
});

describe('validateMetadataPayload — _emailType scoping', () => {
  it('accepts a typology of the mailing company', async () => {
    const result = await validateMetadataPayload(
      { _emailType: TYPE_A },
      { companyId: COMPANY_A }
    );
    expect(String(result._emailType)).toBe(TYPE_A);
  });

  it('refuses a typology of another company', async () => {
    await expect(
      validateMetadataPayload({ _emailType: TYPE_B }, { companyId: COMPANY_A })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.EMAIL_TYPE_NOT_FOUND,
    });
  });

  it('refuses an item of the right company but the wrong taxonomy', async () => {
    await expect(
      validateMetadataPayload({ _emailType: LANG_A }, { companyId: COMPANY_A })
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.EMAIL_TYPE_NOT_FOUND,
    });
  });

  it('scopes the query by company AND type, not by id alone', async () => {
    await validateMetadataPayload(
      { _emailType: TYPE_A },
      { companyId: COMPANY_A }
    );

    const query = TaxonomyItems.findOne.mock.calls[0][0];
    expect(query).toHaveProperty('_company');
    expect(query.type).toBe('emailType');
  });

  it('reports an unknown id as not found, like a foreign one', async () => {
    await expect(
      validateMetadataPayload(
        { _emailType: UNKNOWN_ID },
        { companyId: COMPANY_A }
      )
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.EMAIL_TYPE_NOT_FOUND,
    });
  });

  it('refuses a malformed id without querying the DB', async () => {
    await expect(
      validateMetadataPayload(
        { _emailType: 'not-an-objectid' },
        { companyId: COMPANY_A }
      )
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
    expect(TaxonomyItems.findOne).not.toHaveBeenCalled();
  });

  it.each([[null], ['']])(
    'detaches the typology with %p',
    async (_emailType) => {
      const result = await validateMetadataPayload(
        { _emailType },
        { companyId: COMPANY_A }
      );
      expect('_emailType' in result).toBe(true);
      expect(result._emailType).toBeUndefined();
      expect(TaxonomyItems.findOne).not.toHaveBeenCalled();
    }
  );

  it('refuses a typology on a mailing with no company (super admin case)', async () => {
    await expect(
      validateMetadataPayload({ _emailType: TYPE_A }, { companyId: null })
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.EMAIL_TYPE_COMPANY_MISSING,
    });
    expect(TaxonomyItems.findOne).not.toHaveBeenCalled();
  });

  // The security property of this endpoint. `validated` is built field by field,
  // AND an unknown key is refused outright — so a payload can neither smuggle a
  // mailing field through nor be silently half-honoured.
  it.each([
    ['data', { data: { preheaderText: 'injected' } }],
    ['previewHtml', { previewHtml: '<script>alert(1)</script>' }],
    ['_company', { _company: COMPANY_B }],
    ['name', { name: 'renamed' }],
    ['$set', { $set: { _company: COMPANY_B } }],
    // The one a real client might still send, and the reason this is a 422 rather
    // than a silent drop: it would otherwise get a 200 and believe it saved.
    ['preheader', { preheader: 'no longer a metadata' }],
  ])('refuses a payload carrying %s', async (_name, extra) => {
    await expect(
      validateMetadataPayload(
        { subject: 'ok', ...extra },
        {
          companyId: COMPANY_A,
        }
      )
    ).rejects.toMatchObject({
      status: 422,
      message: ERROR_CODES.INVALID_EMAIL_METADATA,
    });
  });

  it('still lets a company-less mailing set a subject and a date', async () => {
    const result = await validateMetadataPayload(
      { subject: 'ok', plannedSendDate: '2026-09-01T08:00:00.000Z' },
      { companyId: null }
    );
    expect(result.subject).toBe('ok');
    expect(result.plannedSendDate).toBeInstanceOf(Date);
  });
});

describe('applyMetadataToMailing', () => {
  function makeMailing(overrides = {}) {
    return {
      _company: mongoose.Types.ObjectId(COMPANY_A),
      data: { preheaderText: 'template property, untouched' },
      ...overrides,
    };
  }

  // The preheader is not part of this endpoint: it is a template property, and
  // wiring it through here would mean changing how our templates declare it. The
  // refusal happens in the validation, so nothing reaches `data` — the field this
  // endpoint used to write into.
  it('refuses a payload carrying a preheader, leaving data untouched', async () => {
    const mailing = makeMailing();

    await expect(
      applyMetadataToMailing(mailing, {
        subject: 'Soldes',
        preheader: 'no longer a metadata',
      })
    ).rejects.toMatchObject({ status: 422 });

    expect(mailing.subject).toBeUndefined();
    expect(mailing.data).toEqual({
      preheaderText: 'template property, untouched',
    });
  });

  // Emptying a field must clear it, not store a blank. The service assigns
  // `undefined`, which mongoose turns into an $unset at save — the one subtle
  // behaviour left in the function now that markModified is gone.
  it('clears a field by assigning undefined rather than an empty string', async () => {
    const mailing = makeMailing({ subject: 'à effacer' });

    await applyMetadataToMailing(mailing, { subject: '' });

    expect('subject' in mailing).toBe(true);
    expect(mailing.subject).toBeUndefined();
  });

  it('assigns only the fields the payload carries', async () => {
    const mailing = makeMailing({
      subject: 'kept',
      plannedSendDate: 'kept-too',
    });

    await applyMetadataToMailing(mailing, { _emailType: TYPE_A });

    expect(mailing.subject).toBe('kept');
    expect(mailing.plannedSendDate).toBe('kept-too');
    expect(String(mailing._emailType)).toBe(TYPE_A);
  });

  it('refuses a foreign typology through the mailing company, not the caller', async () => {
    const mailing = makeMailing();

    await expect(
      applyMetadataToMailing(mailing, { _emailType: TYPE_B })
    ).rejects.toMatchObject({
      message: ERROR_CODES.EMAIL_TYPE_NOT_FOUND,
    });
  });
});
