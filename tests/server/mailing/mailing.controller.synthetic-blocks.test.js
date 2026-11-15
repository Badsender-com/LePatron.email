'use strict';

// PUT /mailings/:mailingId/mosaico is where a synthetic block becomes
// content; the head CSS written to style it has its own file
// (mailing.controller.head-css.test.js).
// The editor hides the block when the template flag is off, but the block
// definition is injected into every template, so a hand-written request could
// add one anywhere: this endpoint is the gate. It must also keep every existing
// mailing savable when the flag is turned off after blocks were written.
//
// GET /mailings/:mailingId/preview serves previewHtml as text/html: scoped to
// the reader's company and workspace, and sandboxed.

const {
  Templates,
  mailingService,
  controller,
  MAILING_ID,
  user,
  mockMailing,
  mockFlags,
  save,
  resetMocks,
} = require('./update-mosaico.harness.js');
const { htmlBlock, dataWith } = require('./synthetic-blocks.fixtures.js');
const {
  PREVIEW_HTML_MAX_LENGTH,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');

const mockTemplateFlag = (htmlBlockEnabled) => mockFlags({ htmlBlockEnabled });

beforeEach(resetMocks);

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
  // Each block is refused in its own name: a composer told their HTML code
  // block is too large, when they have none, has nothing to act on.
  it.each([
    ['HTML code block', 'htmlCode', 'HTML_CODE_BLOCK_TOO_LARGE'],
    ['composed block', 'builderHtml', 'BLOCK_BUILDER_TOO_LARGE'],
  ])('refuses an oversized %s', async (_label, property, code) => {
    mockMailing(dataWith());
    const type =
      property === 'htmlCode' ? 'htmlCodeBlock' : 'blockBuilderBlock';
    const block = { type, [property]: 'x'.repeat(100001) };

    expect(await save({ data: dataWith(block) })).toMatchObject({
      message: code,
    });
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

// The pipeline judges the right to compose (compose-gate.test.js); this pins
// that the save hands it the capability of the user who is saving.
describe('PUT /mailings/:mailingId/mosaico — the right to compose', () => {
  const { builderBlock } = require('./synthetic-blocks.fixtures.js');
  const {
    generate,
    emptyState,
  } = require('../../../packages/shared/block-builder/generate.js');
  const {
    serialiseState,
  } = require('../../../packages/shared/block-builder/state.js');

  const composed = () => {
    const state = {
      ...emptyState(),
      elements: [{ id: 'el-1', type: 'text', content: 'Bonjour' }],
    };
    return builderBlock(generate(state), serialiseState(state));
  };

  it('refuses a new composed block from a writer', async () => {
    const mailing = mockMailing(dataWith());
    mockFlags({ blockBuilderEnabled: true });

    const error = await save(
      { data: dataWith(composed()) },
      { ...user, role: 'writer' }
    );

    expect(error).toMatchObject({
      status: 403,
      message: 'BLOCK_BUILDER_NOT_PERMITTED',
    });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('lets a writer save an email whose composed block is untouched', async () => {
    const block = composed();
    const mailing = mockMailing(dataWith({ ...block }));
    mockFlags({ blockBuilderEnabled: true });

    const error = await save(
      { data: dataWith({ type: 'textBlock' }, { ...block }) },
      { ...user, role: 'writer' }
    );

    expect(error).toBeNull();
    expect(mailing.save).toHaveBeenCalled();
  });

  it('accepts a new composed block from a regular user', async () => {
    mockMailing(dataWith());
    mockFlags({ blockBuilderEnabled: true });

    expect(
      await save(
        { data: dataWith(composed()) },
        { ...user, role: 'regular_user' }
      )
    ).toBeNull();
  });
});
