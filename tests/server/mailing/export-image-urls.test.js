'use strict';

// The collection and the guard are plain string work inside
// handleRelativeOrFtpImages; the regexes are the whole behaviour, so they are
// what these tests pin down. They live in a module of their own so that these
// tests need not drag in mailing.service.js, its mongoose models and its FTP
// client.
const {
  IMAGE_FILE_URL_REGEX: urlsRegexUrl,
  OWN_IMAGES_URL_REGEX: ownImages,
} = require('../../../packages/server/mailing/export-image-urls.js');

const OURS = 'https://builder.badsender.com/api/images';

describe("collecte des URLs d'images à l'export", () => {
  it('collecte les extensions raster habituelles', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
      expect(
        `${OURS}/cover/600xnull/abc.${ext}`.match(urlsRegexUrl)
      ).toHaveLength(1);
    }
  });

  it('collecte les SVG — le trou qui a laissé passer la campagne', () => {
    expect(`${OURS}/cover/330xnull/abc.svg`.match(urlsRegexUrl)).toHaveLength(
      1
    );
  });

  it('collecte les deux images d’une même ligne', () => {
    const line = `<img src="${OURS}/a.png"><img src="${OURS}/b.png">`;
    expect(line.match(urlsRegexUrl)).toHaveLength(2);
  });

  it('ne traverse pas le CSS minifié entre deux url() d’une même ligne', () => {
    const line =
      `.a{background:url(${OURS}/a.png)}` +
      `.b{background:url('${OURS}/b.png')}`;
    expect(line.match(urlsRegexUrl)).toEqual([
      `${OURS}/a.png`,
      `${OURS}/b.png`,
    ]);
  });

  it('garde les URLs dont la query string porte un &amp;', () => {
    const url = `${OURS}/resize?w=600&amp;src=a.png`;
    expect(`<img src="${url}">`.match(urlsRegexUrl)).toEqual([url]);
  });

  it('rattrape nos URLs quelle que soit l’extension', () => {
    for (const ext of ['bin', 'false', 'svg', 'png']) {
      expect(`${OURS}/cover/176xnull/abc.${ext}`.match(ownImages)).toHaveLength(
        1
      );
    }
  });

  it('ne réclame pas les images hébergées ailleurs', () => {
    expect(
      'https://assets.vorwerk.fr/vorwerk/builder/rea.png'.match(ownImages)
    ).toBeNull();
  });

  it('ne remonte pas jusqu’à une url() précédente du CSS minifié', () => {
    const line =
      '.a{background:url(https://cdn.example/a.png)}' +
      `.b{background:url(${OURS}/b.bin)}`;
    expect(line.match(ownImages)).toEqual([`${OURS}/b.bin`]);
  });

  it('s’arrête aux délimiteurs de balise', () => {
    const [url] = `<img src="${OURS}/a.bin" width="10">`.match(ownImages);
    expect(url).toBe(`${OURS}/a.bin`);
  });
});
