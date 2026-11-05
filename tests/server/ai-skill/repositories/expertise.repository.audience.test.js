'use strict';

// The audience of an expertise applies wherever it is read, in the editor as
// through an assistant (ADR 0013). Whether the company is the platform
// company is read from its id: the caller cannot get it wrong.

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: { find: jest.fn(), distinct: jest.fn() },
  Groups: { findById: jest.fn() },
}));

jest.mock('../../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  findApplicable,
} = require('../../../../packages/server/ai-skill/repositories/expertise.repository');
const {
  Expertises,
  Groups,
} = require('../../../../packages/server/common/models.common');

function mockReturnDocs(docs) {
  Expertises.find.mockReturnValue({ lean: () => Promise.resolve(docs) });
  Expertises.distinct.mockResolvedValue([]);
}

beforeEach(() => jest.clearAllMocks());

describe('the audience of findApplicable', () => {
  const CLIENT_ID = '507f1f77bcf86cd799439011';
  const PLATFORM_ID = '507f1f77bcf86cd799439012';
  const STORED = {
    [CLIENT_ID]: { _id: CLIENT_ID, isPlatform: false },
    [PLATFORM_ID]: { _id: PLATFORM_ID, isPlatform: true },
  };
  const select = jest.fn();

  beforeEach(() => {
    Groups.findById.mockImplementation((id) => ({
      select: (fields) => {
        select(fields);
        return { lean: () => Promise.resolve(STORED[id] || null) };
      },
    }));
  });

  const audienceOf = async (options) => {
    mockReturnDocs([]);
    await findApplicable({ scope: 'cta', categories: ['qc'], ...options });
    return Expertises.find.mock.calls[0][0].audience;
  };

  it('gives a client company only what is opened to all', async () => {
    expect(await audienceOf({ groupId: CLIENT_ID })).toBe('all');
  });

  it('gives the platform company every audience', async () => {
    expect(await audienceOf({ groupId: PLATFORM_ID })).toBe(undefined);
  });

  it('reads of the company whether it is the platform company only', async () => {
    await audienceOf({ groupId: PLATFORM_ID });

    expect(select).toHaveBeenCalledWith('isPlatform');
  });

  it.each([
    ['names no company', {}],
    ['names a company that does not exist', { groupId: '0'.repeat(24) }],
    ['names a company by what is not an id', { groupId: { $ne: null } }],
  ])('treats a call that %s as a client', async (_case, options) => {
    expect(await audienceOf(options)).toBe('all');
  });

  it('never takes the platform company from what the caller passes', async () => {
    expect(
      await audienceOf({ groupId: CLIENT_ID, group: { isPlatform: true } })
    ).toBe('all');
  });

  it('reads every audience for the playground, which says so', async () => {
    expect(await audienceOf({ everyAudience: true })).toBe(undefined);
    expect(Groups.findById).not.toHaveBeenCalled();
  });
});
