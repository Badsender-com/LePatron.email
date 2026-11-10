/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The bound of a preview an assistant reads through MCP (ADR 0012): measured in
// the database, in code points, before the preview is read, and the cache of
// the sanitised previews it shares with the app.

const harness = require('../../helpers/mcp-harness');

// The sanitiser as it is, watched: how often a preview is sanitised.
jest.doMock('../../../packages/server/utils/preview-html-sanitizer.js', () => {
  const actual = jest.requireActual(
    '../../../packages/server/utils/preview-html-sanitizer.js'
  );
  return {
    ...actual,
    sanitizePreviewHtml: jest.fn(actual.sanitizePreviewHtml),
  };
});
const f = require('../../helpers/mcp-fixtures');
const {
  sanitizePreviewHtml,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');

const {
  MAX_PREVIEW_LENGTH,
} = require('../../../packages/server/mcp/mcp-mailing-read.js');
// The models the harness stands in for, to watch what is read of them.
const {
  Mailings,
} = require('../../../packages/server/common/models.common.js');

const getMailing = async (client, args) =>
  harness.answerOf(
    await client.callTool({ name: 'get_mailing', arguments: args })
  );

describe('the bound of a mailing preview', () => {
  let client;
  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  it('gives no content for a preview too large to read, and says so', async () => {
    harness.update('mailings', f.M_NEWSLETTER, {
      previewHtml: `<p>${'x'.repeat(MAX_PREVIEW_LENGTH)}</p>`,
    });

    const answer = await getMailing(client, { mailingId: f.M_NEWSLETTER });

    expect(answer).toMatchObject({ text: null, contentMissing: 'too-large' });
  });

  it('never reads a preview past the bound out of the database', async () => {
    harness.update('mailings', f.M_NEWSLETTER, {
      previewHtml: `<p>${'x'.repeat(MAX_PREVIEW_LENGTH)}</p>`,
    });
    const reads = ['find', 'findOne', 'findById'].map((name) =>
      jest.spyOn(Mailings, name)
    );

    try {
      const answer = await getMailing(client, { mailingId: f.M_NEWSLETTER });

      expect(answer).toMatchObject({ contentMissing: 'too-large' });
      const projections = reads.flatMap((spy) =>
        spy.mock.calls.map(([, projection]) => JSON.stringify(projection))
      );
      expect(projections.length).toBeGreaterThan(0);
      projections.forEach((projection) => {
        // Every read names its fields, and none is the preview.
        expect(projection).toBeDefined();
        expect(projection).not.toMatch(/previewHtml/);
      });
    } finally {
      reads.forEach((spy) => spy.mockRestore());
    }
  });

  it('measures a preview in code points, as the database does', async () => {
    const smileys = '\u{1F600}'.repeat(Math.floor(MAX_PREVIEW_LENGTH) - 100);
    harness.update('mailings', f.M_NEWSLETTER, {
      previewHtml: `<p>${smileys}</p>`,
    });

    const answer = await getMailing(client, { mailingId: f.M_NEWSLETTER });

    expect(answer.contentMissing).toBeUndefined();
    expect(answer.text).toContain('\u{1F600}');
  });

  it('sanitises a preview just within the bound once, for every read', async () => {
    // A whole document, as the editor saves it: sanitised, it keeps its
    // length.
    const open = '<html><head></head><body><p>';
    const close = '</p></body></html>';
    const words =
      Math.floor(MAX_PREVIEW_LENGTH) - 1 - open.length - close.length;
    harness.update('mailings', f.M_NEWSLETTER, {
      previewHtml: `${open}${'x'.repeat(words)}${close}`,
      updatedAt: new Date(),
    });
    sanitizePreviewHtml.mockClear();

    await getMailing(client, { mailingId: f.M_NEWSLETTER });
    const again = await getMailing(client, { mailingId: f.M_NEWSLETTER });

    expect(again.contentMissing).toBeUndefined();
    expect(sanitizePreviewHtml).toHaveBeenCalledTimes(1);
  });
});
