/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The external images of a mailing's preview, relayed by the instance (ADR
// 0022, epic #1485). The app's CSP keeps images to the instance: the preview
// it is handed rewrites every image hosted elsewhere to an address of the
// instance, signed for that image, with no expiry. The instance fetches it
// then, under the guard of the outgoing calls, and serves it if it is a PNG,
// a JPEG, a GIF or a WebP. Nothing is stored.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const mockGuardedFetch = jest.fn();
jest.mock(
  '../../../packages/server/integration-providers/provider-http.js',
  () => ({
    ...jest.requireActual(
      '../../../packages/server/integration-providers/provider-http.js'
    ),
    guardedFetch: (...args) => mockGuardedFetch(...args),
  })
);

const express = require('express');
const request = require('../../helpers/local-request');
const {
  siteOrigin,
} = require('../../../packages/server/email-templates/email-template.js');

const PREVIEW_KEY = 'email.lepatron/previewHtml';
const LOGO = 'https://cdn.example.test/brand/logo.png';
const BACKGROUND = 'https://cdn.example.test/brand/bg.jpg';
const BANNER = 'https://img.example.test/banner.gif';

// The first bytes each kind of image starts with.
const PNG = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0,
  0,
  0,
  0x0d,
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const HTML = Buffer.from('<!DOCTYPE html><html></html>');

// What the guarded fetch answers: a response whose body is these bytes.
const answers = (bytes, contentType = 'image/png', status = 200) =>
  mockGuardedFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === 'content-type' ? contentType : null) },
    buffer: async () => bytes,
  });

describe('relayed images', () => {
  beforeEach(() => {
    mockGuardedFetch.mockReset();
  });

  // Turned on by #1487 (a signed route serves an external image)
  describe('the relayed image', () => {
    let app;
    let relayedPathOf;

    beforeAll(() => {
      // Required here: the modules do not exist until #1487 ships them.
      const relay = require('../../../packages/server/mcp/mcp-relayed-images.js');
      const router = require('../../../packages/server/mcp/mcp-relayed-images.routes.js');
      app = express();
      app.use('/api/relayed-images', router);
      relayedPathOf = (url) =>
        new URL(relay.relayedUrlOf(url)).pathname +
        new URL(relay.relayedUrlOf(url)).search;
    });

    it('serves the image, with its type, a day of cache and no sniffing', async () => {
      answers(PNG);

      const res = await request(app).get(relayedPathOf(LOGO));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['cache-control']).toMatch(/max-age=86400/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.from(res.body)).toEqual(PNG);
    });

    it('fetches under the guard of the outgoing calls: https at every hop, 3 redirects, 10 s, 5 MB', async () => {
      answers(JPEG, 'image/jpeg');

      await request(app).get(relayedPathOf(BACKGROUND));

      expect(mockGuardedFetch).toHaveBeenCalledWith(
        BACKGROUND,
        expect.objectContaining({
          httpsOnly: true,
          maxRedirects: 3,
          timeoutMs: 10000,
          maxBytes: 5 * 1024 * 1024,
        })
      );
    });

    it('takes the type from the content, not from what the host says', async () => {
      answers(JPEG, 'application/octet-stream');

      const res = await request(app).get(relayedPathOf(BACKGROUND));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
    });

    it.each([
      ['an SVG', SVG, 'image/svg+xml'],
      ['a page said to be an image', HTML, 'image/png'],
    ])('serves no %s', async (_case, bytes, contentType) => {
      answers(bytes, contentType);

      const res = await request(app).get(relayedPathOf(LOGO));

      expect(res.status).toBe(404);
    });

    it('fetches nothing for an address it did not sign', async () => {
      const signed = relayedPathOf(LOGO);
      const forged = signed.replace(
        encodeURIComponent(LOGO),
        encodeURIComponent('https://cdn.example.test/other.png')
      );

      const res = await request(app).get(forged);

      expect(res.status).toBe(404);
      expect(mockGuardedFetch).not.toHaveBeenCalled();
    });

    it('fetches nothing over plain http, even signed', async () => {
      const res = await request(app).get(
        relayedPathOf('http://cdn.example.test/brand/logo.png')
      );

      expect(res.status).toBe(404);
      expect(mockGuardedFetch).not.toHaveBeenCalled();
    });

    it.each([
      ['the host refuses it', () => answers(PNG, 'image/png', 404)],
      [
        'the guard refuses the host or a hop',
        () => mockGuardedFetch.mockRejectedValue(new Error('refused host')),
      ],
    ])('answers no image when %s', async (_case, arrange) => {
      arrange();

      const res = await request(app).get(relayedPathOf(LOGO));

      expect(res.status).toBe(404);
    });
  });

  // Turned on by #1488 (the preview relays the external images)
  describe('the preview relays the external images', () => {
    const ON_INSTANCE = `${siteOrigin()}/api/images/cover/600xnull/hero.jpeg`;
    const WITH_EXTERNAL_IMAGES = `<!DOCTYPE html><html><head><style>.hero { background-image: url('${BANNER}'); }</style></head><body>
<table role="presentation" background="${BACKGROUND}"><tr><td>
<img src="${LOGO}" alt="Brand" width="223">
<img src="${ON_INSTANCE}" alt="" width="600">
<div class="hero">Black Friday</div>
</td></tr></table></body></html>`;
    const M_IMAGES = '507f1f77bcf86cd799439409';

    beforeEach(() =>
      harness.seed({
        ...f.SEED,
        mailings: [
          ...f.MAILINGS,
          {
            ...f.MAILINGS[0],
            _id: M_IMAGES,
            name: 'With external images',
            previewHtml: WITH_EXTERNAL_IMAGES,
          },
        ],
      })
    );
    afterEach(() => harness.disconnect());

    const read = async (mailingId, format) => {
      const client = await harness.connectAs(f.FRANK);
      return client.callTool({
        name: 'get_mailing',
        arguments: { mailingId, ...(format && { format }) },
      });
    };
    const relayedOf = (url) =>
      require('../../../packages/server/mcp/mcp-relayed-images.js').relayedUrlOf(
        url
      );

    it('hands the app every external image at its relayed address', async () => {
      const result = await read(M_IMAGES);

      const preview = result._meta[PREVIEW_KEY];
      [LOGO, BACKGROUND, BANNER].forEach((url) => {
        expect(preview).toContain(relayedOf(url).replace(/&/g, '&amp;'));
        expect(preview).not.toContain(`"${url}"`);
      });
    });

    it('relays an image of a style attribute, whatever its quotes', () => {
      const {
        relayPreviewImages,
      } = require('../../../packages/server/mcp/mcp-relayed-images.js');

      const html = relayPreviewImages(
        `<td style="background-image: url(&quot;${LOGO}&quot;)"></td>`
      );

      expect(html).toBe(
        `<td style="background-image: url(&quot;${relayedOf(
          LOGO
        )}&quot;)"></td>`
      );
    });

    it('leaves the images of the instance where they are', async () => {
      const result = await read(M_IMAGES);

      expect(result._meta[PREVIEW_KEY]).toContain(`src="${ON_INSTANCE}"`);
    });

    it('lets the assistant read the original addresses, and hands the app the relayed preview beside them', async () => {
      const result = await read(M_IMAGES, 'html');

      expect(result.structuredContent.html).toContain(`src="${LOGO}"`);
      expect(result._meta[PREVIEW_KEY]).toContain(
        relayedOf(LOGO).replace(/&/g, '&amp;')
      );
    });

    it('changes nothing in the preview of a mailing whose images are all on the instance', async () => {
      const result = await read(f.M_NEWSLETTER, 'html');

      expect(result._meta).toBeUndefined();
    });
  });
});
