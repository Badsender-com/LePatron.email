'use strict';

// PUT /mailings/:mailingId/mosaico also carries the per-mailing head CSS.
//
// Same gate as the HTML code block, and for the same reason: the editor hides
// the editing surface when the template flag is off, but the route accepts
// hand-written requests. What this file pins above all is the absence of two
// regressions:
//
//   - a client that does not send `headCss` must not wipe a stored stylesheet
//     (an older editor bundle, or the metadata route);
//   - turning the flag off must leave the mailing savable and the CSS
//     clearable.

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
const {
  HEAD_CSS_MAX_LENGTH,
} = require('../../../packages/server/mailing/head-css-guard.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const TEMPLATE_ID = '507f1f77bcf86cd799439002';
const user = {
  id: 'user-1',
  isAdmin: false,
  lang: 'fr',
  group: { id: '507f1f77bcf86cd799439003' },
};

const EMPTY_DATA = { mainBlocks: { blocks: [] } };

function mockMailing(storedHeadCss) {
  const mailing = {
    _id: MAILING_ID,
    _wireframe: TEMPLATE_ID,
    data: EMPTY_DATA,
    headCss: storedHeadCss,
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
  };
  Mailings.findOne.mockResolvedValue(mailing);
  return mailing;
}

function mockTemplateFlag(htmlBlockEnabled) {
  Templates.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ htmlBlockEnabled }) }),
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

beforeEach(() => {
  jest.resetAllMocks();
  mailingService.assertUserCanEditMailing.mockResolvedValue(undefined);
  Mailings.findOneForMosaico.mockResolvedValue({});
});

describe('PUT /mailings/:mailingId/mosaico — head CSS and the template flag', () => {
  it('stores the stylesheet when the template enables it', async () => {
    const mailing = mockMailing('');
    mockTemplateFlag(true);

    expect(
      await save({ data: EMPTY_DATA, headCss: '.a{color:red}' })
    ).toBeNull();
    expect(mailing.headCss).toBe('.a{color:red}');
    expect(mailing.save).toHaveBeenCalled();
  });

  it('refuses a new stylesheet when the template does not enable it', async () => {
    const mailing = mockMailing('');
    mockTemplateFlag(false);

    const error = await save({ data: EMPTY_DATA, headCss: '.a{color:red}' });

    expect(error).toMatchObject({
      status: 403,
      message: 'HTML_CODE_BLOCK_DISABLED',
    });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  // The regression the rule exists to avoid.
  it('keeps the mailing savable when the stored stylesheet is unchanged', async () => {
    const mailing = mockMailing('.a{color:red}');
    mockTemplateFlag(false);

    expect(
      await save({ data: EMPTY_DATA, headCss: '.a{color:red}' })
    ).toBeNull();
    expect(mailing.save).toHaveBeenCalled();
  });

  it('lets the author clear the stylesheet even with the flag off', async () => {
    const mailing = mockMailing('.a{color:red}');
    mockTemplateFlag(false);

    expect(await save({ data: EMPTY_DATA, headCss: '' })).toBeNull();
    expect(mailing.headCss).toBe('');
  });
});

describe('PUT /mailings/:mailingId/mosaico — head CSS size', () => {
  it('refuses a stylesheet past the limit', async () => {
    const mailing = mockMailing('');
    mockTemplateFlag(true);

    const error = await save({
      data: EMPTY_DATA,
      headCss: 'a'.repeat(HEAD_CSS_MAX_LENGTH + 1),
    });

    expect(error).toMatchObject({
      status: 400,
      message: 'HEAD_CSS_TOO_LARGE',
    });
    expect(mailing.save).not.toHaveBeenCalled();
  });
});

describe('PUT /mailings/:mailingId/mosaico — clients unaware of head CSS', () => {
  it('leaves the stored stylesheet alone when the field is absent', async () => {
    const mailing = mockMailing('.a{color:red}');
    mockTemplateFlag(true);

    expect(await save({ data: EMPTY_DATA })).toBeNull();
    expect(mailing.headCss).toBe('.a{color:red}');
  });

  it('costs no template query when there is neither block nor CSS', async () => {
    mockMailing('');

    expect(await save({ data: EMPTY_DATA })).toBeNull();
    expect(Templates.findById).not.toHaveBeenCalled();
  });
});
