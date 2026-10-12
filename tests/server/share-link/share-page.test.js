'use strict';

// The public page a share link opens, without an account: it must serve
// nothing that can run, leak nothing, and fail as a page.

const {
  ShareLinks,
  Mailings,
  Groups,
  MAILING_ID,
  LINK_ID,
  lean,
  call,
  resetMocks,
} = require('./share-link.harness.js');
const service = require('../../../packages/server/share-link/share-link.service.js');
const pageController = require('../../../packages/server/share-link/share-page.controller.js');

beforeEach(resetMocks);

describe('GET /share/:token', () => {
  const TOKEN = 'a'.repeat(43);
  const activeLink = {
    _id: LINK_ID,
    _mailing: MAILING_ID,
    lang: 'fr',
    expiresAt: new Date('2030-10-13T16:42:00Z'),
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
    expect(locals).toMatchObject({ name: 'Soldes' });
    // Until when, to the minute, in the platform's zone, named.
    expect(locals.meta).toMatch(/jusqu'au 13 octobre 2030.*18:42 UTC\+2/);
    // Sanitized, every link opening in a new tab (sanitizeSharedPreviewHtml).
    expect(locals.html).toBe('clean:<p>hi</p>');
    expect(res.headers['Content-Security-Policy']).toContain(
      "default-src 'none'"
    );
    expect(res.headers['Content-Security-Policy']).not.toMatch(/script-src/);
    expect(res.headers['Referrer-Policy']).toBe('no-referrer');
    expect(res.headers['X-Robots-Tag']).toContain('noindex');
    expect(res.headers['Cache-Control']).toContain('no-store');
  });

  it('closes with the company: inactive, without the email builder, or sharing turned off', async () => {
    ShareLinks.findOne.mockReturnValue(lean({ ...activeLink, _company: 'c1' }));
    Mailings.findById.mockReturnValue(
      lean({
        _id: MAILING_ID,
        _company: 'c1',
        name: 'Soldes',
        previewHtml: '<p>hi</p>',
      })
    );
    for (const group of [
      { status: 'inactive' },
      { status: 'active', enableEmailBuilder: false },
      { status: 'active', enableEmailBuilder: true, enableShareLinks: false },
      null,
    ]) {
      Groups.findById.mockReturnValue(lean(group));
      const { res } = await call(pageController.renderShare, {
        params: { token: TOKEN },
      });
      expect(res.statusCode).toBe(404);
      expect(res.render.mock.calls[0][1].title).toBe('Lien introuvable');
    }
  });

  it('judges the company the email belongs to now, not the one of the link', async () => {
    // Transferred since the link was made: the link's company is fine, the
    // email's current one is inactive.
    ShareLinks.findOne.mockReturnValue(lean({ ...activeLink, _company: 'c1' }));
    Mailings.findById.mockReturnValue(
      lean({
        _id: MAILING_ID,
        _company: 'c2',
        name: 'Soldes',
        previewHtml: '<p>hi</p>',
      })
    );
    Groups.findById.mockImplementation((id) =>
      lean(id === 'c2' ? { status: 'inactive' } : { status: 'active' })
    );
    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(res.statusCode).toBe(404);
    expect(Groups.findById).toHaveBeenCalledTimes(1);
    expect(Groups.findById.mock.calls[0][0]).toBe('c2');
    expect(Mailings.findById.mock.calls[0][1]).toMatchObject({ _company: 1 });
  });

  it('shows the subject and the preheader when the company writes them in LePatron', async () => {
    ShareLinks.findOne.mockReturnValue(lean({ ...activeLink, _company: 'c1' }));
    const saved = {
      _id: MAILING_ID,
      _company: 'c1',
      name: 'Soldes',
      subject: ' Nos soldes ',
      data: { preheaderBlock: { preheaderText: "Jusqu'à -50 %" } },
      previewHtml: '<p>hi</p>',
    };
    Mailings.findById.mockReturnValue(lean(saved));
    const render = async (group) => {
      Groups.findById.mockReturnValue(lean(group));
      const { res } = await call(pageController.renderShare, {
        params: { token: TOKEN },
      });
      return res.render.mock.calls[0][1].copy;
    };

    expect(
      await render({ status: 'active', emailMetadata: { enabled: true } })
    ).toEqual([
      { label: 'Objet', value: 'Nos soldes' },
      { label: 'Préheader', value: "Jusqu'à -50 %" },
    ]);
    expect(await render({ status: 'active' })).toEqual([]);
    // Only the preheader of the content model is read, never all of it.
    expect(Mailings.findById.mock.calls[0][1]).toMatchObject({
      subject: 1,
      'data.preheaderText': 1,
      'data.preheaderBlock.preheaderText': 1,
    });
    expect(Mailings.findById.mock.calls[0][1]).not.toHaveProperty('data');
  });

  it('leaves out a preheader the template turned off', async () => {
    ShareLinks.findOne.mockReturnValue(lean({ ...activeLink, _company: 'c1' }));
    Groups.findById.mockReturnValue(
      lean({ status: 'active', emailMetadata: { enabled: true } })
    );
    Mailings.findById.mockReturnValue(
      lean({
        _id: MAILING_ID,
        _company: 'c1',
        name: 'Soldes',
        subject: 'Nos soldes',
        data: { preheaderText: 'Caché', preheaderVisible: false },
        previewHtml: '<p>hi</p>',
      })
    );
    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(res.render.mock.calls[0][1].copy).toEqual([
      { label: 'Objet', value: 'Nos soldes' },
    ]);
    expect(Mailings.findById.mock.calls[0][1]).toMatchObject({
      'data.preheaderVisible': 1,
    });
  });

  it('leaves out a subject or a preheader not filled in', async () => {
    ShareLinks.findOne.mockReturnValue(lean({ ...activeLink, _company: 'c1' }));
    Groups.findById.mockReturnValue(
      lean({ status: 'active', emailMetadata: { enabled: true } })
    );
    Mailings.findById.mockReturnValue(
      lean({
        _id: MAILING_ID,
        _company: 'c1',
        name: 'Soldes',
        subject: '',
        data: { preheaderText: 'Vu en premier' },
        previewHtml: '<p>hi</p>',
      })
    );
    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(res.render.mock.calls[0][1].copy).toEqual([
      { label: 'Préheader', value: 'Vu en premier' },
    ]);
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
    Mailings.findById.mockReturnValue(lean({ _id: 'unsaved', name: 'x' }));
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
