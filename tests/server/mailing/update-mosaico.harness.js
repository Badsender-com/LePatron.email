'use strict';

// Shared by the PUT /mailings/:mailingId/mosaico tests: the mocked database
// and collaborators, a stored mailing and its template's flags, and the
// driver that runs the controller to its answer.
//
// Required before anything it mocks: the jest.mock calls below register on the
// test's module registry when this file loads.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findOne: jest.fn(), findOneForMosaico: jest.fn() },
  Templates: { findById: jest.fn() },
  Galleries: {},
  Users: {},
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  assertUserCanEditMailing: jest.fn(),
  previewMail: jest.fn(),
}));
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

const {
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const controller = require('../../../packages/server/mailing/mailing.controller.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const TEMPLATE_ID = '507f1f77bcf86cd799439002';
const user = {
  id: 'user-1',
  isAdmin: false,
  lang: 'fr',
  group: { id: '507f1f77bcf86cd799439003' },
};

/** The mailing the route finds, storing `storedData` and `storedHeadCss`. */
function mockMailing(storedData, storedHeadCss) {
  const mailing = {
    _id: MAILING_ID,
    _wireframe: TEMPLATE_ID,
    data: storedData,
    headCss: storedHeadCss,
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
  };
  Mailings.findOne.mockResolvedValue(mailing);
  return mailing;
}

/** The flags of the mailing's template, as the guard selects them. */
function mockFlags(flags) {
  Templates.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(flags) }),
  });
}

// Resolves with the error passed to `next`, or null when the request succeeded.
function save(body) {
  return new Promise((resolve) => {
    const res = { json: () => resolve(null) };
    controller.updateMosaico(
      { params: { mailingId: MAILING_ID }, body, user },
      res,
      resolve
    );
  });
}

function resetMocks() {
  jest.resetAllMocks();
  mailingService.assertUserCanEditMailing.mockResolvedValue(undefined);
  Mailings.findOneForMosaico.mockResolvedValue({});
}

module.exports = {
  Templates,
  mailingService,
  controller,
  MAILING_ID,
  TEMPLATE_ID,
  user,
  mockMailing,
  mockFlags,
  save,
  resetMocks,
};
