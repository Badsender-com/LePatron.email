'use strict';

// The CDN download, kept as it was when the export started rewriting images
// from a map of hosted URLs (#1612): the ZIP holds the HTML pointing at the
// CDN, the images, and a notice listing where each image goes.
//
// Driven through `mailingService.downloadZip`, the stores faked in memory and
// the images' sources behind `request`, which the regular and CDN downloads
// stream into the archive.

jest.mock('request', () =>
  jest.fn(() => {
    const { EventEmitter } = require('events');
    const image = new EventEmitter();
    process.nextTick(() => image.emit('response', { statusCode: 200 }));
    return image;
  })
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {},
  Workspaces: {},
  Galleries: {},
  Folders: {},
  Groups: { findById: jest.fn() },
}));

const mongoose = require('mongoose');
const { Groups } = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');

const COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');
const HERO = 'https://lepatron.example.com/api/images/hero-5f3a.png';
const LOGO = 'https://cdn.client.example.com/brand/logo.gif';
const CDN = 'https://cdn.example.com/emails/soldes-ete';

const HTML = `<html><body>
<img src="${HERO}" alt="">
<table background="${LOGO}"><tr><td>Hello</td></tr></table>
</body></html>`;

function query(value) {
  const chain = {
    lean: () => chain,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
}

describe('downloading the ZIP for a CDN', () => {
  let entries;

  beforeEach(async () => {
    Groups.findById.mockImplementation((id) =>
      query({
        _id: id,
        downloadMailingWithCdnImages: true,
        cdnProtocol: 'https://',
        cdnEndPoint: 'cdn.example.com/emails/',
      })
    );
    jest.spyOn(mailingService, 'getMailByMailingIdAndUser').mockResolvedValue({
      _id: '507f1f77bcf86cd799439055',
      name: 'Soldes été',
      _company: COMPANY,
      _wireframe: { _id: 'tpl', _company: COMPANY },
      _doc: { data: {} },
    });

    entries = [];
    await mailingService.downloadZip({
      mailingId: '507f1f77bcf86cd799439055',
      html: HTML,
      user: { id: 'user-1' },
      downloadOptions: { downLoadForCdn: true },
      archive: {
        append: (content, { name, prefix = '' }) =>
          entries.push({
            path: `${prefix}${name}`,
            content: typeof content === 'string' ? content : null,
          }),
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const entry = (path) => entries.find((e) => e.path === path);

  it('points every image at the CDN, in the folder of the email', () => {
    const html = entry('soldes-ete/soldes-ete.html').content;

    expect(html).not.toContain(HERO);
    expect(html).not.toContain(LOGO);
    expect(html.match(new RegExp(`${CDN}/[^"]+`, 'g'))).toHaveLength(2);
  });

  it('bundles the images to put on the CDN', () => {
    expect(
      entries.filter((e) => e.path.startsWith('soldes-ete/images/'))
    ).toHaveLength(2);
  });

  // The notice read a path the rewrite never returned, and listed
  // `undefined/<image>`.
  it('says in the notices where each image goes', () => {
    const markdown = entry('soldes-ete/notice.md').content;
    const html = entry('soldes-ete/notice.html').content;

    expect(markdown).toContain(CDN);
    expect(markdown).not.toContain('undefined');
    expect(html).toContain(CDN);
    expect(html).not.toContain('undefined');
  });
});
