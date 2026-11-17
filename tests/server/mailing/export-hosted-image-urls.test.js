'use strict';

// Once its images are hosted, the export rewrites each of them from a map of
// its relative path (`images/hero.png`, given while collecting) to its hosted
// URL. The FTP and CDN exports fill the map from their endpoint; an image host
// fills it with the URLs it returns, which its file names do not predict
// (ADR 0028).
const {
  relativeImagePath,
  hostedUrlsUnderEndpoint,
  rewriteHostedImages,
} = require('../../../packages/server/mailing/export-hosted-image-urls.js');

describe('the relative path the export first gives an image', () => {
  it('is the images folder and the image name', () => {
    expect(relativeImagePath('hero.png')).toBe('images/hero.png');
  });
});

describe('hosted URLs under an FTP or CDN endpoint', () => {
  it("places each image in the email's folder under the endpoint", () => {
    const { hostedUrls, endpointPath } = hostedUrlsUnderEndpoint({
      endpointBase: 'https://cdn.example.com/emails',
      folderName: 'soldes-ete',
      imageNames: ['hero.png', 'logo.gif'],
    });

    expect(endpointPath).toBe('https://cdn.example.com/emails/soldes-ete');
    expect([...hostedUrls]).toEqual([
      ['images/hero.png', 'https://cdn.example.com/emails/soldes-ete/hero.png'],
      ['images/logo.gif', 'https://cdn.example.com/emails/soldes-ete/logo.gif'],
    ]);
  });

  it('adds no second slash after an endpoint that ends with one', () => {
    const { endpointPath } = hostedUrlsUnderEndpoint({
      endpointBase: 'https://cdn.example.com/emails/',
      folderName: 'soldes-ete',
      imageNames: [],
    });

    expect(endpointPath).toBe('https://cdn.example.com/emails/soldes-ete');
  });
});

describe('rewriting the hosted images of an email', () => {
  const hosted = new Map([
    ['images/hero.png', 'https://link.example.net/custloads/123/9001_hero.png'],
    ['images/logo.gif', 'https://link.example.net/custloads/123/9002_logo.gif'],
  ]);

  it('replaces every place an image is loaded from', () => {
    const html = `<img src="images/hero.png">
<td background="images/logo.gif" style="background-image:url(images/logo.gif)">
<img src="images/hero.png">`;

    expect(rewriteHostedImages(html, hosted)).toBe(
      `<img src="https://link.example.net/custloads/123/9001_hero.png">
<td background="https://link.example.net/custloads/123/9002_logo.gif" style="background-image:url(https://link.example.net/custloads/123/9002_logo.gif)">
<img src="https://link.example.net/custloads/123/9001_hero.png">`
    );
  });

  // The paths went into a regex unescaped: `(` opened a group, and an image
  // named `hero(1).png` was never rewritten.
  it('rewrites an image whose name holds regex characters', () => {
    const html = '<img src="images/hero(1).png"><img src="images/a+b.png">';
    const urls = new Map([
      ['images/hero(1).png', 'https://cdn.example.com/x/hero(1).png'],
      ['images/a+b.png', 'https://cdn.example.com/x/a+b.png'],
    ]);

    expect(rewriteHostedImages(html, urls)).toBe(
      '<img src="https://cdn.example.com/x/hero(1).png"><img src="https://cdn.example.com/x/a+b.png">'
    );
  });

  it('reads a dot in a name as a dot', () => {
    const html = '<img src="images/heroXpng">';

    expect(rewriteHostedImages(html, hosted)).toBe(html);
  });

  it('keeps a hosted URL holding a `$` as it is', () => {
    const urls = new Map([
      ['images/hero.png', 'https://cdn.example.com/$1/hero.png'],
    ]);

    expect(rewriteHostedImages('<img src="images/hero.png">', urls)).toBe(
      '<img src="https://cdn.example.com/$1/hero.png">'
    );
  });

  it('does not rewrite again a hosted URL that holds another relative path', () => {
    const urls = new Map([
      ['images/a.png', 'https://cdn.example.com/images/b.png'],
      ['images/b.png', 'https://cdn.example.com/x/b.png'],
    ]);

    expect(rewriteHostedImages('<img src="images/a.png">', urls)).toBe(
      '<img src="https://cdn.example.com/images/b.png">'
    );
  });

  it('rewrites a longer name sharing the start of a shorter one', () => {
    const urls = new Map([
      ['images/a.png', 'https://cdn.example.com/a.png'],
      ['images/a.png.webp', 'https://cdn.example.com/a.png.webp'],
    ]);

    expect(rewriteHostedImages('<img src="images/a.png.webp">', urls)).toBe(
      '<img src="https://cdn.example.com/a.png.webp">'
    );
  });

  it('leaves alone what is not in the map', () => {
    const html = '<img src="images/other.png"><a href="https://example.com">';

    expect(rewriteHostedImages(html, hosted)).toBe(html);
  });
});
