'use strict';

// The public page a share link opens, without an account: it must serve
// nothing that can run, leak nothing, and fail as a page.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  ShareLinks: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  Mailings: { findById: jest.fn() },
  Groups: { findById: jest.fn() },
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
  assertUserCanEditMailing: jest.fn(),
  sanitizePreviewCached: jest.fn((mailing) => `clean:${mailing.previewHtml}`),
}));

const {
  ShareLinks,
  Mailings,
  Groups,
} = require('../../../packages/server/common/models.common.js');
const logger = require('../../../packages/server/utils/logger.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const service = require('../../../packages/server/share-link/share-link.service.js');
const pageController = require('../../../packages/server/share-link/share-page.controller.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const LINK_ID = '507f1f77bcf86cd799439011';
const user = { id: '507f1f77bcf86cd799439099', name: 'Ana', lang: 'fr' };
const mailing = { _id: MAILING_ID, _company: 'c1' };

const lean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

function fakeRes() {
  const res = {
    headers: {},
    statusCode: 200,
    set: jest.fn((headers) => Object.assign(res.headers, headers)),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(),
    end: jest.fn(),
    render: jest.fn(),
  };
  return res;
}

async function call(handler, req) {
  const res = fakeRes();
  let error;
  await handler(
    {
      params: {},
      body: {},
      user,
      get: () => 'evil.test',
      is: (type) => type === 'application/json',
      protocol: 'http',
      ...req,
    },
    res,
    (err) => {
      error = err;
    }
  );
  return { res, error };
}

beforeEach(() => {
  jest.clearAllMocks();
  mailingService.findOneForUser.mockResolvedValue(mailing);
  mailingService.assertUserCanEditMailing.mockResolvedValue();
  Groups.findById.mockReturnValue(
    lean({ status: 'active', enableEmailBuilder: true })
  );
});

describe('GET /share/:token', () => {
  const TOKEN = 'a'.repeat(43);
  const activeLink = {
    _id: LINK_ID,
    _mailing: MAILING_ID,
    lang: 'fr',
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };

  it('shows the last saved version, sanitized, under a strict policy', async () => {
    ShareLinks.findOne.mockReturnValue(lean(activeLink));
    Mailings.findById.mockReturnValue(
      lean({ _id: MAILING_ID, name: 'Soldes', previewHtml: '<p>hi</p>' })
    );

    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
      user: undefined,
    });

    expect(ShareLinks.findOne).toHaveBeenCalledWith({
      tokenHash: service.hashToken(TOKEN),
    });
    const [view, locals] = res.render.mock.calls[0];
    expect(view).toBe('share-page');
    expect(locals).toMatchObject({ name: 'Soldes', html: 'clean:<p>hi</p>' });
    expect(res.headers['Content-Security-Policy']).toContain(
      "default-src 'none'"
    );
    expect(res.headers['Content-Security-Policy']).not.toMatch(/script-src/);
    expect(res.headers['Referrer-Policy']).toBe('no-referrer');
    expect(res.headers['X-Robots-Tag']).toContain('noindex');
    expect(res.headers['Cache-Control']).toContain('no-store');
  });

  it('closes with the company: inactive, or without the email builder', async () => {
    ShareLinks.findOne.mockReturnValue(lean({ ...activeLink, _company: 'c1' }));
    Mailings.findById.mockReturnValue(
      lean({ _id: MAILING_ID, name: 'Soldes', previewHtml: '<p>hi</p>' })
    );
    for (const group of [
      { status: 'inactive' },
      { status: 'active', enableEmailBuilder: false },
      null,
    ]) {
      Groups.findById.mockReturnValue(lean(group));
      const { res } = await call(pageController.renderShare, {
        params: { token: TOKEN },
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('sanitizes a shared version once, however large', async () => {
    ShareLinks.findOne.mockReturnValue(lean(activeLink));
    Mailings.findById.mockReturnValue(
      lean({
        _id: 'big',
        name: 'Big',
        updatedAt: new Date('2026-09-01'),
        previewHtml: 'x'.repeat(2 * 1024 * 1024),
      })
    );
    await call(pageController.renderShare, { params: { token: TOKEN } });
    await call(pageController.renderShare, { params: { token: TOKEN } });
    expect(mailingService.sanitizePreviewCached).toHaveBeenCalledTimes(1);
  });

  it('never looks up a token of the wrong shape', async () => {
    const { res } = await call(pageController.renderShare, {
      params: { token: '../etc' },
    });
    expect(ShareLinks.findOne).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it('reads a revoked link as unknown, an expired one as expired', async () => {
    ShareLinks.findOne.mockReturnValue(
      lean({ ...activeLink, revokedAt: new Date() })
    );
    const revoked = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(revoked.res.statusCode).toBe(404);

    ShareLinks.findOne.mockReturnValue(
      lean({ ...activeLink, expiresAt: new Date(Date.now() - 1000) })
    );
    const expired = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(expired.res.statusCode).toBe(410);
    expect(Mailings.findById).not.toHaveBeenCalled();
  });

  it('says so when the email was never saved, or is gone', async () => {
    ShareLinks.findOne.mockReturnValue(lean(activeLink));
    Mailings.findById.mockReturnValue(lean({ _id: MAILING_ID, name: 'x' }));
    const empty = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(empty.res.statusCode).toBe(404);
    expect(empty.res.render.mock.calls[0][1].title).toBe('Aperçu indisponible');

    Mailings.findById.mockReturnValue(lean(null));
    const gone = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(gone.res.render.mock.calls[0][1].title).toBe('Lien introuvable');
  });
});

describe('share-page.pug', () => {
  const pug = require('pug');
  const path = require('path');
  const render = (locals) =>
    pug.renderFile(
      path.join(
        __dirname,
        '../../../packages/server/html-templates/share-page.pug'
      ),
      locals
    );

  it('keeps the email inside a sandboxed srcdoc, escaped, and runs no script', () => {
    const page = render({
      lang: 'fr',
      title: '"><script>alert(1)</script>',
      name: '"><script>alert(1)</script>',
      meta: 'meta',
      html: '<p class="x">Hello</p>"><script>alert(2)</script>',
    });
    expect(page).not.toMatch(/<script/i);
    expect(page).toMatch(/<iframe[^>]*sandbox=""/);
    expect(page).toMatch(/<iframe[^>]*referrerpolicy="no-referrer"/);
    expect(page).toContain('srcdoc="&lt;p class=&quot;x&quot;&gt;Hello');
  });
});

describe('request logs', () => {
  const tokens = (url) => ({ url: () => url });

  it('keep only the first characters of a share token', () => {
    const token = 'AbCd' + 'x'.repeat(39);
    expect(logger.loggedUrl(tokens(`/share/${token}`))).toBe('/share/AbCd…');
    expect(logger.loggedUrl(tokens(`/share/${token}?utm=1`))).toBe(
      '/share/AbCd…?utm=1'
    );
  });

  it('leave every other address alone', () => {
    expect(logger.loggedUrl(tokens('/api/mailings/m1/share-links'))).toBe(
      '/api/mailings/m1/share-links'
    );
  });
});

describe('GET /share/:token, the edges', () => {
  const TOKEN = 'b'.repeat(43);
  const link = {
    _id: '507f1f77bcf86cd799439022',
    _mailing: MAILING_ID,
    lang: 'en',
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };

  it('answers a failure with a page, never the JSON error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ShareLinks.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('Mongo down')),
    });
    const { res, error } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(500);
    expect(res.render.mock.calls[0][0]).toBe('share-page');
    expect(res.json).not.toHaveBeenCalled();
    console.error.mockRestore();
  });

  it("speaks its creator's language", async () => {
    ShareLinks.findOne.mockReturnValue(
      lean({ ...link, expiresAt: new Date(Date.now() - 1000) })
    );
    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(res.render.mock.calls[0][1]).toMatchObject({
      lang: 'en',
      title: 'Link expired',
    });
  });

  it('stops a link opened too often', async () => {
    ShareLinks.findOne.mockReturnValue(lean(link));
    Mailings.findById.mockReturnValue(
      lean({ _id: 'm2', name: 'x', previewHtml: '<p>x</p>' })
    );
    let last;
    for (let i = 0; i < 301; i += 1) {
      last = await call(pageController.renderShare, {
        params: { token: TOKEN },
      });
    }
    expect(last.res.statusCode).toBe(429);
  });
});
