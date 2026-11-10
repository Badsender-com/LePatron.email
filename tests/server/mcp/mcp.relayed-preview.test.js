'use strict';

// The preview an app is handed, its external images rewritten to their
// relayed addresses (ADR 0022). The rewriting runs on every preview,
// synchronously, on what the mailing's author wrote.

const {
  relayPreviewImages,
  relayPreviewImagesCached,
  relayedUrlOf,
} = require('../../../packages/server/mcp/mcp-relayed-images.js');

const LOGO = 'https://cdn.example.test/brand/logo.png';

describe('the rewriting of a preview', () => {
  it('takes linear time, whatever the author wrote', () => {
    const many = 100000;
    const html = [
      `<p>${'url('.repeat(many)}</p>`,
      `<style>${'url('.repeat(many)}</style>`,
      `<td style="${'url(&quot;'.repeat(many)}"></td>`,
      `<td style="background: url(${'a'.repeat(many)}"></td>`,
      `<img src="${LOGO}" ${'src="x" '.repeat(many)}>`,
    ].join('');

    const started = Date.now();
    relayPreviewImages(html);

    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('leaves the text of the email as it is', () => {
    const html = `<p>Write url(${LOGO}) in a style.</p>`;

    expect(relayPreviewImages(html)).toBe(html);
  });

  it('rewrites a preview once for each saved preview of a mailing', () => {
    const key = '507f1f77bcf86cd799439409:1700000000000:42';
    const first = relayPreviewImagesCached(key, `<img src="${LOGO}">`);

    const again = relayPreviewImagesCached(key, '<img src="other">');

    expect(first).toBe(`<img src="${relayedUrlOf(LOGO)}">`);
    expect(again).toBe(first);
  });

  it('rewrites a preview without a key every time', () => {
    relayPreviewImagesCached(undefined, `<img src="${LOGO}">`);

    expect(relayPreviewImagesCached(undefined, '<p>Hi</p>')).toBe('<p>Hi</p>');
  });

  describe('what it writes is inert wherever it lands', () => {
    const QUOTED = "https://cdn.example.test/brand/l'o(g)o.png";

    it('encodes in a relayed address every character a CSS string or a url() ends on', () => {
      const address = relayedUrlOf(QUOTED);

      expect(address).not.toMatch(/['()]/);
      expect(new URL(address).searchParams.get('url')).toBe(QUOTED);
    });

    it('reads the entities of an attribute', () => {
      const html = relayPreviewImages(
        `<td style="background: url(&quot;${LOGO}?a=1&amp;b=2&quot;)"></td>`
      );

      expect(html).toBe(
        `<td style="background: url(&quot;${relayedUrlOf(
          `${LOGO}?a=1&b=2`
        )}&quot;)"></td>`
      );
    });

    it('reads a style sheet as it is, its entities never decoded', () => {
      const written = 'https://cdn.example.test/x&#39;';

      const html = relayPreviewImages(
        `<style>.a { background: url('${written}'); }</style>`
      );

      expect(html).toBe(
        `<style>.a { background: url('${relayedUrlOf(written)}'); }</style>`
      );
      expect(relayedUrlOf(written)).not.toContain("'");
    });
  });
});
