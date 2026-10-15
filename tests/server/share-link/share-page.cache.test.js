'use strict';

// A public page can be hammered with views: the sanitized email of a shared
// version is held per version, and its HTML read from the database only when
// the version is not held yet.

const {
  ShareLinks,
  Mailings,
  MAILING_ID,
  LINK_ID,
  lean,
  call,
  resetMocks,
} = require('./share-link.harness.js');
const previewSanitizer = require('../../../packages/server/utils/preview-html-sanitizer.js');
const pageController = require('../../../packages/server/share-link/share-page.controller.js');

beforeEach(resetMocks);

describe('GET /share/:token, the cache', () => {
  const TOKEN = 'a'.repeat(43);
  const activeLink = {
    _id: LINK_ID,
    _mailing: MAILING_ID,
    lang: 'fr',
    expiresAt: new Date('2030-10-13T16:42:00Z'),
  };

  // The stored mailing, read as the page reads it: previewHtml only when the
  // projection asks for it, so that the reads of it can be counted.
  function storedMailing(doc) {
    Mailings.findById.mockReset();
    Mailings.findById.mockImplementation((id, projection) =>
      lean(projection.previewHtml ? doc : { ...doc, previewHtml: undefined })
    );
    return () =>
      Mailings.findById.mock.calls.filter(([, projection]) =>
        Object.prototype.hasOwnProperty.call(projection, 'previewHtml')
      ).length;
  }

  it('sanitizes a shared version once, and reads its HTML once', async () => {
    ShareLinks.findOne.mockReturnValue(lean(activeLink));
    const previewReads = storedMailing({
      _id: 'big',
      name: 'Big',
      updatedAt: new Date('2026-09-01'),
      previewHtml: 'x'.repeat(2 * 1024 * 1024),
    });
    const first = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    const second = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(previewSanitizer.sanitizeSharedPreviewHtml).toHaveBeenCalledTimes(1);
    expect(previewReads()).toBe(1);
    expect(second.res.render.mock.calls[0][1].html).toBe(
      first.res.render.mock.calls[0][1].html
    );
    // The first read of a view never carries the HTML.
    expect(Mailings.findById.mock.calls[0][1]).not.toHaveProperty(
      'previewHtml'
    );
  });

  it('reads and sanitizes again once the email was saved', async () => {
    ShareLinks.findOne.mockReturnValue(lean(activeLink));
    storedMailing({
      _id: 'edited',
      name: 'v1',
      updatedAt: new Date('2026-09-01'),
      previewHtml: '<p>v1</p>',
    });
    await call(pageController.renderShare, { params: { token: TOKEN } });
    const previewReads = storedMailing({
      _id: 'edited',
      name: 'v2',
      updatedAt: new Date('2026-09-02'),
      previewHtml: '<p>v2</p>',
    });
    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(res.render.mock.calls[0][1].html).toBe('clean:<p>v2</p>');
    expect(previewReads()).toBe(1);
  });

  // Above maxEntry, a page would be sanitized again on every view (about a
  // second per MB, synchronously): the largest preview the editor may save
  // must be held.
  it('holds a page as large as the editor may save, sanitized once', async () => {
    ShareLinks.findOne.mockReturnValue(lean(activeLink));
    storedMailing({
      _id: 'huge',
      name: 'Huge',
      updatedAt: new Date('2026-09-01'),
      previewHtml: 'x'.repeat(4.5 * 1000 * 1000),
    });
    await call(pageController.renderShare, { params: { token: TOKEN } });
    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(previewSanitizer.sanitizeSharedPreviewHtml).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });
});
