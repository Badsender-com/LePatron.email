'use strict';

// The collection and the guard are plain string work inside
// handleRelativeOrFtpImages; the regexes are the whole behaviour, so they are
// what these tests pin down. Requiring mailing.service.js would drag in
// mongoose models and an FTP client for no benefit here.
const SOURCE = require('fs').readFileSync(
  require('path').resolve(
    __dirname,
    '../../../packages/server/mailing/mailing.service.js'
  ),
  'utf8'
);

// keep in sync with mailing.service.js — the test fails loudly if they drift
const extract = (name) => {
  const line = SOURCE.split('\n').find((l) => l.includes(`const ${name} = /`));
  if (!line) throw new Error(`${name} not found in mailing.service.js`);
  const body = line.slice(line.indexOf('/') + 1, line.lastIndexOf('/'));
  const flags = line.slice(line.lastIndexOf('/') + 1).replace(/[;\s]/g, '');
  return new RegExp(body, flags);
};

const urlsRegexUrl = extract('urlsRegexUrl');
const ownImages = extract('OWN_IMAGES_URL_REGEX');

const OURS = 'https://builder.badsender.com/api/images';

describe('collecte des URLs d\'images à l\'export', () => {
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

  it('s’arrête aux délimiteurs de balise', () => {
    const [url] = `<img src="${OURS}/a.bin" width="10">`.match(ownImages);
    expect(url).toBe(`${OURS}/a.bin`);
  });
});
