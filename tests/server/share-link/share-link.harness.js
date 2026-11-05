'use strict';

// Shared by the share link tests: the mocked database and collaborators, a
// fake response, and the driver that runs a controller to its answer.
//
// Required before anything it mocks: the jest.mock calls below register on the
// test's module registry when this file loads.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  ShareLinks: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
  Mailings: { findById: jest.fn() },
  Groups: { findById: jest.fn() },
  Templates: { findById: jest.fn() },
}));
// A key-independent stand-in for AES: what matters is that the token is
// sealed, opened back, and never stored as is.
jest.mock('../../../packages/server/utils/crypto.js', () => ({
  encrypt: jest.fn((text) => `sealed:${Buffer.from(text).toString('hex')}`),
  decrypt: jest.fn((sealed) =>
    Buffer.from(sealed.replace('sealed:', ''), 'hex').toString()
  ),
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
  assertUserCanEditMailing: jest.fn(),
}));
jest.mock('../../../packages/server/utils/preview-html-sanitizer.js', () => ({
  ...jest.requireActual(
    '../../../packages/server/utils/preview-html-sanitizer.js'
  ),
  sanitizeSharedPreviewHtml: jest.fn((html) => `clean:${html}`),
}));

const {
  ShareLinks,
  Mailings,
  Groups,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const LINK_ID = '507f1f77bcf86cd799439011';
const user = { id: '507f1f77bcf86cd799439099', name: 'Ana', lang: 'fr' };
const mailing = { _id: MAILING_ID, _company: 'c1' };

const lean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

function fakeRes() {
  const res = {
    headers: {},
    statusCode: 200,
    set: jest.fn((headers, value) =>
      Object.assign(
        res.headers,
        typeof headers === 'string' ? { [headers]: value } : headers
      )
    ),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(),
    end: jest.fn(),
    render: jest.fn(),
  };
  return res;
}

async function call(handler, req) {
  const res = fakeRes();
  let error;
  await handler(
    {
      params: {},
      body: {},
      user,
      get: () => 'evil.test',
      is: (type) => type === 'application/json',
      protocol: 'http',
      ip: '10.0.0.1',
      ...req,
    },
    res,
    (err) => {
      error = err;
    }
  );
  return { res, error };
}

/** Mocks cleared, and an editable email of an active company. */
function resetMocks() {
  jest.clearAllMocks();
  mailingService.findOneForUser.mockResolvedValue(mailing);
  mailingService.assertUserCanEditMailing.mockResolvedValue();
  Groups.findById.mockReturnValue(
    lean({ status: 'active', enableEmailBuilder: true })
  );
}

module.exports = {
  ShareLinks,
  Mailings,
  Groups,
  Templates,
  mailingService,
  MAILING_ID,
  LINK_ID,
  user,
  mailing,
  lean,
  fakeRes,
  call,
  resetMocks,
};
