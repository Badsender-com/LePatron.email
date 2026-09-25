'use strict';

// PUT /mailings/:mailingId/mosaico is where the HTML code block — and the head
// CSS written to style it — become content.
// The editor hides the block when the template flag is off, but the block
// definition is injected into every template, so a hand-written request could
// add one anywhere: this endpoint is the gate. It must also keep every existing
// mailing savable when the flag is turned off after blocks were written.
//
// GET /mailings/:mailingId/preview serves previewHtml as text/html: scoped to
// the reader's company and workspace, and sandboxed.

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
  PREVIEW_HTML_MAX_LENGTH,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');
const {
  HEAD_CSS_MAX_LENGTH,
} = require('../../../packages/shared/head-css/constants.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const TEMPLATE_ID = '507f1f77bcf86cd799439002';
const user = {
  id: 'user-1',
  isAdmin: false,
  lang: 'fr',
  group: { id: '507f1f77bcf86cd799439003' },
};

const htmlBlock = (htmlCode) => ({ type: 'htmlCodeBlock', htmlCode });
const dataWith = (...blocks) => ({ mainBlocks: { blocks } });

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

describe('PUT /mailings/:mailingId/mosaico — the template flag', () => {
  it('accepts a new HTML code block when the template enables it', async () => {
    const mailing = mockMailing(dataWith());
    mockTemplateFlag(true);

    expect(await save({ data: dataWith(htmlBlock('<p>new</p>')) })).toBeNull();
    expect(mailing.save).toHaveBeenCalled();
  });

  it('refuses a new HTML code block when the template does not enable it', async () => {
    const mailing = mockMailing(dataWith());
    mockTemplateFlag(false);

    const error = await save({ data: dataWith(htmlBlock('<p>new</p>')) });

    expect(error).toMatchObject({
      status: 403,
      message: 'HTML_CODE_BLOCK_DISABLED',
    });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('refuses changed markup in an existing block when the flag is off', async () => {
    mockMailing(dataWith(htmlBlock('<p>stored</p>')));
    mockTemplateFlag(false);

    const error = await save({ data: dataWith(htmlBlock('<p>changed</p>')) });

    expect(error).toMatchObject({ status: 403 });
  });

  // The regression the rule exists to avoid: a super admin turns the flag off
  // after blocks were written, and their authors can no longer save anything.
  it('keeps a mailing savable when its stored blocks are unchanged', async () => {
    const mailing = mockMailing(dataWith(htmlBlock('<p>stored</p>')));
    mockTemplateFlag(false);

    const body = {
      data: dataWith({ type: 'textBlock' }, htmlBlock('<p>stored</p>')),
    };

    expect(await save(body)).toBeNull();
    expect(mailing.save).toHaveBeenCalled();
  });

  it('checks every container, not only mainBlocks', async () => {
    mockMailing({});
    mockTemplateFlag(false);

    const error = await save({
      data: { footerBlocks: { blocks: [htmlBlock('<p>x</p>')] } },
    });

    expect(error).toMatchObject({ status: 403 });
  });

  it('does not load the template for a mailing without HTML code block', async () => {
    mockMailing(dataWith());

    expect(await save({ data: dataWith({ type: 'textBlock' }) })).toBeNull();
    expect(Templates.findById).not.toHaveBeenCalled();
  });
});

describe('PUT /mailings/:mailingId/mosaico — sizes', () => {
  it('refuses an oversized HTML code block', async () => {
    mockMailing(dataWith());
    mockTemplateFlag(true);

    const error = await save({ data: dataWith(htmlBlock('x'.repeat(100001))) });

    expect(error).toMatchObject({ message: 'HTML_CODE_BLOCK_TOO_LARGE' });
  });

  // previewHtml is sanitized each time it is served; unbounded, it was an easy
  // way to stall the server.
  it('refuses an oversized preview', async () => {
    const mailing = mockMailing(dataWith());

    const error = await save({
      data: dataWith(),
      htmlToExport: 'x'.repeat(PREVIEW_HTML_MAX_LENGTH + 1),
    });

    expect(error).toMatchObject({ message: 'PREVIEW_HTML_TOO_LARGE' });
    expect(mailing.save).not.toHaveBeenCalled();
  });
});

// Head CSS rides the same route, under the same flag, and is stored outside
// `data`. What needs pinning is the same asymmetry as above — the flag going
// off must not lock an author out — plus one thing the block does not have: a
// client that says nothing about the CSS must not erase it.
describe('PUT /mailings/:mailingId/mosaico — head CSS', () => {
  const EMPTY = dataWith();

  it('stores the stylesheet when the template enables it', async () => {
    const mailing = mockMailing(EMPTY, '');
    mockTemplateFlag(true);

    expect(await save({ data: EMPTY, headCss: '.a{color:red}' })).toBeNull();
    expect(mailing.headCss).toBe('.a{color:red}');
  });

  it('refuses a new stylesheet when the template does not enable it', async () => {
    const mailing = mockMailing(EMPTY, '');
    mockTemplateFlag(false);

    const error = await save({ data: EMPTY, headCss: '.a{color:red}' });

    expect(error).toMatchObject({
      status: 403,
      message: 'HTML_CODE_BLOCK_DISABLED',
    });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('keeps the mailing savable when the stored stylesheet is unchanged', async () => {
    const mailing = mockMailing(EMPTY, '.a{color:red}');
    mockTemplateFlag(false);

    expect(await save({ data: EMPTY, headCss: '.a{color:red}' })).toBeNull();
    expect(mailing.save).toHaveBeenCalled();
  });

  it('lets the author clear it even with the flag off', async () => {
    const mailing = mockMailing(EMPTY, '.a{color:red}');
    mockTemplateFlag(false);

    expect(await save({ data: EMPTY, headCss: '' })).toBeNull();
    expect(mailing.headCss).toBe('');
  });

  it('refuses a stylesheet past the limit', async () => {
    const mailing = mockMailing(EMPTY, '');
    mockTemplateFlag(true);

    const error = await save({
      data: EMPTY,
      headCss: 'a'.repeat(HEAD_CSS_MAX_LENGTH + 1),
    });

    expect(error).toMatchObject({ message: 'HEAD_CSS_TOO_LARGE' });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  // An older editor bundle, or the metadata route, says nothing about headCss.
  it('leaves the stored stylesheet alone when the field is absent', async () => {
    const mailing = mockMailing(EMPTY, '.a{color:red}');
    mockTemplateFlag(true);

    expect(await save({ data: EMPTY })).toBeNull();
    expect(mailing.headCss).toBe('.a{color:red}');
  });

  it('loads the template once for both guards, and only when needed', async () => {
    mockMailing(EMPTY, '');

    expect(await save({ data: EMPTY })).toBeNull();
    expect(Templates.findById).not.toHaveBeenCalled();
  });
});

describe('GET /mailings/:mailingId/preview', () => {
  function preview() {
    return new Promise((resolve, reject) => {
      const res = {
        headers: {},
        set(name, value) {
          this.headers[name] = value;
        },
        send(body) {
          resolve({ body, headers: this.headers });
        },
      };
      controller.previewHtml(
        { params: { mailingId: MAILING_ID }, user },
        res,
        reject
      );
    });
  }

  it('reads the preview as the requesting user', async () => {
    mailingService.previewMail.mockResolvedValue('<p>ok</p>');

    await preview();

    expect(mailingService.previewMail).toHaveBeenCalledWith(MAILING_ID, user);
  });

  // Opened directly in a tab, the document must not run in the app's origin.
  it('serves the preview under a CSP sandbox', async () => {
    mailingService.previewMail.mockResolvedValue('<p>ok</p>');

    const { headers } = await preview();

    expect(headers['Content-Security-Policy']).toBe('sandbox');
  });
});
