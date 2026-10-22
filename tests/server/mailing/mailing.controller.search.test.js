'use strict';

// GET /mailings/search reads its pagination and filters as JSON query
// parameters (epic #1144). An absent one is empty; a malformed one is the
// caller's mistake, a 400, where the folder listing's bare JSON.parse answers
// a 500.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {},
  Templates: {},
  Galleries: {},
  Users: {},
}));
jest.mock('../../../packages/server/mailing/mailing-search.service.js', () => ({
  searchMailings: jest.fn(async () => ({ meta: {}, items: { docs: [] } })),
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({}));
jest.mock(
  '../../../packages/server/mailing/send-test-mail.controller.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/mailing/download-zip.controller.js',
  () => ({})
);
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  searchMailings,
} = require('../../../packages/server/mailing/mailing-search.service.js');
const controller = require('../../../packages/server/mailing/mailing.controller.js');

const user = { id: 'u1', group: { id: 'company-a' } };

function search(query) {
  return new Promise((resolve) => {
    const res = { json: (body) => resolve({ status: 200, body }) };
    controller.search({ user, query }, res, (err) =>
      resolve({ status: err.status, message: err.message })
    );
  });
}

beforeEach(() => jest.clearAllMocks());

describe('GET /mailings/search, its query parameters', () => {
  it('hands the parsed pagination and filters to the search', async () => {
    const answer = await search({
      pagination: JSON.stringify({ page: 2, itemsPerPage: 50 }),
      filters: JSON.stringify({ name: 'spring' }),
    });

    expect(answer.status).toBe(200);
    expect(searchMailings).toHaveBeenCalledWith({
      user,
      pagination: { page: 2, itemsPerPage: 50 },
      filters: { name: 'spring' },
    });
  });

  it('reads absent parameters as empty', async () => {
    await search({});

    expect(searchMailings).toHaveBeenCalledWith({
      user,
      pagination: {},
      filters: {},
    });
  });

  it.each([
    ['malformed pagination', { pagination: '{page:' }, 'BAD_FORMAT_PAGINATION'],
    ['malformed filters', { filters: 'spring' }, 'BAD_FORMAT_FILTERS'],
    ['filters that are not an object', { filters: '[]' }, 'BAD_FORMAT_FILTERS'],
  ])('answers %s with a 400', async (_, query, code) => {
    expect(await search(query)).toEqual({
      status: 400,
      message: ERROR_CODES[code],
    });
    expect(searchMailings).not.toHaveBeenCalled();
  });
});
