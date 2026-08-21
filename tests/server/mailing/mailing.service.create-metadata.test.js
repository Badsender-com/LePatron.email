'use strict';

// The PATCH route is gated by GUARD_EMAIL_METADATA. Creation must honour the same
// flag, otherwise `POST /mailings` is the way around it: the fields would be
// persisted for a company that never opted in, and would surface in the listing
// the day the columns are displayed.
//
// Nothing is rejected when the company is opted out — a stale front must not lose
// the ability to create emails — the metadata is simply not stored. This test pins
// both halves of that rule.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { create: jest.fn() },
  Workspaces: { exists: jest.fn().mockReturnValue(true) },
  Galleries: {},
  Folders: { exists: jest.fn().mockReturnValue(true) },
  Groups: { findById: jest.fn() },
  Templates: {},
  TaxonomyItems: { findOne: jest.fn() },
}));
jest.mock('../../../packages/server/template/template.service.js', () => ({
  findOne: jest.fn(),
  doesUserHaveAccess: jest.fn(),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Groups,
  TaxonomyItems,
} = require('../../../packages/server/common/models.common.js');
const templateService = require('../../../packages/server/template/template.service.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const COMPANY_A = '507f1f77bcf86cd799439a01';
const TEMPLATE_ID = '507f1f77bcf86cd799439201';
const WORKSPACE_ID = '507f1f77bcf86cd799439301';
const TYPE_A = '507f1f77bcf86cd799439101';

const user = {
  id: 'user-1',
  name: 'Alice',
  lang: 'fr',
  isAdmin: false,
  group: { id: COMPANY_A },
};

function mockCompanyFlag(enabled) {
  Groups.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        emailMetadata: enabled === undefined ? undefined : { enabled },
      }),
    }),
  });
}

// Captures what reaches the database, which is the only thing that matters here.
function captureCreated() {
  const created = {};
  Mailings.create.mockImplementation(async (doc) => {
    Object.assign(created, doc);
    return { toJSON: () => ({ ...doc }), data: null };
  });
  return created;
}

async function create(metadata) {
  return mailingService.createInsideWorkspaceOrFolder({
    templateId: TEMPLATE_ID,
    workspaceId: WORKSPACE_ID,
    mailingName: 'Campagne',
    user,
    metadata,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  templateService.findOne.mockResolvedValue({
    _id: TEMPLATE_ID,
    name: 'Badsender News',
    _company: COMPANY_A,
  });
  TaxonomyItems.findOne.mockResolvedValue({
    _id: TYPE_A,
    _company: COMPANY_A,
    type: 'emailType',
  });
});

describe('createInsideWorkspaceOrFolder — metadata behind the company flag', () => {
  it('stores the metadata when the company opted in', async () => {
    mockCompanyFlag(true);
    const created = captureCreated();

    await create({
      subject: 'Soldes',
      plannedSendDate: '2026-09-01T08:00:00.000Z',
      _emailType: TYPE_A,
    });

    expect(created.subject).toBe('Soldes');
    expect(created.plannedSendDate).toBeInstanceOf(Date);
    expect(String(created._emailType)).toBe(TYPE_A);
  });

  it.each([
    ['opted out', false],
    ['never configured', undefined],
  ])('stores nothing when the company %s', async (_label, enabled) => {
    mockCompanyFlag(enabled);
    const created = captureCreated();

    await create({ subject: 'Soldes', _emailType: TYPE_A });

    expect(created).not.toHaveProperty('subject');
    expect(created).not.toHaveProperty('_emailType');
  });

  it('still creates the email when the company opted out', async () => {
    mockCompanyFlag(false);
    const created = captureCreated();

    await create({ subject: 'Soldes' });

    expect(created.name).toBe('Campagne');
    expect(Mailings.create).toHaveBeenCalled();
  });

  it('does not query the company at all on an ordinary creation', async () => {
    mockCompanyFlag(true);
    captureCreated();

    await create(undefined);
    await create({});
    await create({ subject: undefined, plannedSendDate: undefined });

    expect(Groups.findById).not.toHaveBeenCalled();
  });

  it('validates the typology like the PATCH does, company scope included', async () => {
    mockCompanyFlag(true);
    captureCreated();
    // A typology of another company: the scoped lookup finds nothing.
    TaxonomyItems.findOne.mockResolvedValue(null);

    await expect(create({ _emailType: TYPE_A })).rejects.toMatchObject({
      message: ERROR_CODES.EMAIL_TYPE_NOT_FOUND,
    });

    expect(Mailings.create).not.toHaveBeenCalled();
  });

  it('scopes the typology lookup on the caller company, never on the payload', async () => {
    mockCompanyFlag(true);
    captureCreated();

    await create({ _emailType: TYPE_A });

    const query = TaxonomyItems.findOne.mock.calls[0][0];
    expect(String(query._company)).toBe(COMPANY_A);
    expect(query.type).toBe('emailType');
  });
});
