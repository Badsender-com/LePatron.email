'use strict';

// `findOneForMosaico` is the only PR1/PR2 interface this change touches, and it is
// what decides whether the editor panel exists at all: the editor tests for the
// presence of `emailMetadataConfig`. So a company that opted out must get neither
// key — not a key set to a falsy value, which would still tell the editor the
// feature is there.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn().mockResolvedValue(null),
}));

const mongoose = require('mongoose');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');

const findOneForMosaico = MailingSchema.statics.findOneForMosaico;

const COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');
const MAILING = mongoose.Types.ObjectId('507f1f77bcf86cd799439055');
const TEMPLATE = mongoose.Types.ObjectId('507f1f77bcf86cd799439201');
const TYPE_ACTIVE = mongoose.Types.ObjectId('507f1f77bcf86cd799439101');

const ACTIVE_TYPES = [
  {
    _id: TYPE_ACTIVE,
    label: 'Infolettre',
    canonicalType: 'newsletter',
    order: 0,
  },
  { _id: mongoose.Types.ObjectId('507f1f77bcf86cd799439102'), label: 'Promo' },
];

// Minimal `this` for the static: the mailing, the company, and the taxonomy model
// it reaches through mongoose.models.
const OTHER_COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439b01');

function makeContext({
  companyFlag,
  mailingOverrides = {},
  taxonomy = ACTIVE_TYPES,
  // company of the TEMPLATE; equal to the mailing's unless a test diverges them
  templateCompany = COMPANY,
  otherCompanyFlag,
}) {
  const mailing = {
    _id: MAILING,
    name: 'Campagne',
    data: { preheaderText: 'dans data' },
    previewHtml: '',
    _workspace: mongoose.Types.ObjectId('507f1f77bcf86cd799439301'),
    _company: { _id: COMPANY, id: String(COMPANY), name: 'Company A' },
    _wireframe: {
      _id: TEMPLATE,
      name: 'Badsender News',
      _company: templateCompany,
      assets: {},
    },
    ...mailingOverrides,
  };

  const model = {
    findOne: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mailing),
      }),
    }),
  };

  const taxonomyFind = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(taxonomy),
      }),
    }),
  });

  const findById = jest.fn().mockImplementation(async (id) => {
    const isOther = String(id) === String(OTHER_COMPANY);
    const flag = isOther ? otherCompanyFlag : companyFlag;
    return {
      _id: mongoose.Types.ObjectId(String(id)),
      name: isOther ? 'Company B' : 'Company A',
      ...(flag === undefined ? {} : { emailMetadata: flag }),
    };
  });

  mongoose.models = {
    Company: { findById },
    TaxonomyItem: { find: taxonomyFind },
    Comment: null,
  };

  return { model, taxonomyFind, findById };
}

const call = (context) =>
  findOneForMosaico.call(context.model, { isAdmin: false }, {});

describe('findOneForMosaico — company opted out', () => {
  it.each([
    ['no config at all', undefined],
    ['an explicitly disabled config', { enabled: false, requiredFields: [] }],
    ['an empty config', {}],
    ['a truthy-but-not-true value', { enabled: 'yes' }],
  ])('exposes neither key with %s', async (_label, companyFlag) => {
    const context = makeContext({ companyFlag });

    const result = await call(context);

    // Absent, not present-and-undefined: the editor decides the panel exists
    // from the presence of the key.
    expect('emailMetadata' in result.metadata).toBe(false);
    expect('emailMetadataConfig' in result.metadata).toBe(false);
  });

  it('does not query the taxonomy at all', async () => {
    const context = makeContext({ companyFlag: { enabled: false } });

    await call(context);

    expect(context.taxonomyFind).not.toHaveBeenCalled();
  });

  it('still returns everything the editor needs to open', async () => {
    const result = await call(makeContext({ companyFlag: undefined }));

    expect(result.metadata.id).toEqual(MAILING);
    expect(result.metadata.url.update).toBe(`/api/mailings/${MAILING}/mosaico`);
    expect(result.data).toEqual({ preheaderText: 'dans data' });
  });
});

// `group` in this function is the TEMPLATE's company, on purpose, for the
// download options. Reusing it for the metadata would read the flag and the
// typology list of whichever company owns the template — and the write path
// validates against the MAILING's company, so we would offer typologies the save
// refuses, and show one company's vocabulary inside another's editor.
describe('findOneForMosaico — the metadata follow the mailing company', () => {
  const enabled = { enabled: true, requiredFields: [] };

  it('reads the typologies of the mailing company, not the template one', async () => {
    const context = makeContext({ companyFlag: enabled });

    await call(context);

    expect(String(context.taxonomyFind.mock.calls[0][0]._company)).toBe(
      String(COMPANY)
    );
  });

  it('exposes nothing when the mailing and its template belong to different companies', async () => {
    const context = makeContext({
      companyFlag: enabled,
      otherCompanyFlag: enabled,
      templateCompany: OTHER_COMPANY,
    });

    const result = await call(context);

    expect('emailMetadataConfig' in result.metadata).toBe(false);
    expect(context.taxonomyFind).not.toHaveBeenCalled();
  });

  // The state above is what a broken template access check produces; exposing
  // the template company's vocabulary there is the leak this guards against.
  it('does not leak the other company vocabulary on divergence', async () => {
    const context = makeContext({
      companyFlag: undefined,
      otherCompanyFlag: enabled,
      templateCompany: OTHER_COMPANY,
    });

    const result = await call(context);

    expect('emailMetadata' in result.metadata).toBe(false);
    expect(context.taxonomyFind).not.toHaveBeenCalled();
  });

  // A mailing created by a super admin has no company of its own; the template's
  // is then the only reference, and it is the one the download options use.
  it('falls back on the template company for a mailing without one', async () => {
    const context = makeContext({
      companyFlag: enabled,
      mailingOverrides: { _company: undefined },
    });

    const result = await call(context);

    expect(result.metadata.emailMetadataConfig.enabled).toBe(true);
    expect(String(context.taxonomyFind.mock.calls[0][0]._company)).toBe(
      String(COMPANY)
    );
  });
});

describe('findOneForMosaico — company opted in', () => {
  const flag = { enabled: true, requiredFields: ['subject'] };

  it('exposes the values the panel edits', async () => {
    const context = makeContext({
      companyFlag: flag,
      mailingOverrides: {
        subject: 'Soldes',
        plannedSendDate: new Date('2026-09-01T08:00:00.000Z'),
        _emailType: TYPE_ACTIVE,
      },
    });

    const { emailMetadata } = (await call(context)).metadata;

    expect(emailMetadata.subject).toBe('Soldes');
    expect(emailMetadata.plannedSendDate).toEqual(
      new Date('2026-09-01T08:00:00.000Z')
    );
    expect(emailMetadata.emailTypeId).toEqual(TYPE_ACTIVE);
  });

  it('exposes the config the panel renders from', async () => {
    const { emailMetadataConfig } = (
      await call(makeContext({ companyFlag: flag }))
    ).metadata;

    expect(emailMetadataConfig.enabled).toBe(true);
    expect(emailMetadataConfig.requiredFields).toEqual(['subject']);
    expect(emailMetadataConfig.emailTypes).toEqual([
      { id: TYPE_ACTIVE, label: 'Infolettre', canonicalType: 'newsletter' },
      {
        id: mongoose.Types.ObjectId('507f1f77bcf86cd799439102'),
        label: 'Promo',
        canonicalType: undefined,
      },
    ]);
    expect(emailMetadataConfig.url.update).toBe(
      `/api/mailings/${MAILING}/metadata`
    );
  });

  it('reads the typologies of that company only, active ones only', async () => {
    const context = makeContext({ companyFlag: flag });

    await call(context);

    const query = context.taxonomyFind.mock.calls[0][0];
    expect(String(query._company)).toBe(String(COMPANY));
    expect(query.type).toBe('emailType');
    expect(query.isActive).toBe(true);
  });

  // The preheader lives in the template's own `data`, which the editor already
  // holds live. A copy here would be a second value competing with the one that
  // reaches the sent email.
  it('never exposes the preheader among the metadata', async () => {
    const { emailMetadata } = (
      await call(makeContext({ companyFlag: flag }))
    ).metadata;

    expect(emailMetadata).not.toHaveProperty('preheader');
    expect(emailMetadata).not.toHaveProperty('preheaderText');
    expect(Object.keys(emailMetadata).sort()).toEqual([
      'emailTypeId',
      'plannedSendDate',
      'subject',
    ]);
  });

  it('exposes an empty typology list rather than failing, on a company with none', async () => {
    const { emailMetadataConfig } = (
      await call(makeContext({ companyFlag: flag, taxonomy: [] }))
    ).metadata;

    expect(emailMetadataConfig.emailTypes).toEqual([]);
    expect(emailMetadataConfig.enabled).toBe(true);
  });

  it('defaults requiredFields to an empty array', async () => {
    const { emailMetadataConfig } = (
      await call(makeContext({ companyFlag: { enabled: true } }))
    ).metadata;

    expect(emailMetadataConfig.requiredFields).toEqual([]);
  });
});
