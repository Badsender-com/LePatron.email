'use strict';

// A share link opens an email to anyone who holds it, without an account. The
// token is the only credential: it must be unguessable and never stored as is.

const {
  ShareLinks,
  Groups,
  mailingService,
  MAILING_ID,
  LINK_ID,
  lean,
  call,
  resetMocks,
} = require('./share-link.harness.js');
const config = require('../../../packages/server/node.config.js');
const service = require('../../../packages/server/share-link/share-link.service.js');
const controller = require('../../../packages/server/share-link/share-link.controller.js');

beforeEach(resetMocks);

describe('validateCreatePayload', () => {
  it('takes 1, 7 or 30 days, 7 by default', () => {
    expect(service.validateCreatePayload({})).toEqual({ expiresInDays: 7 });
    expect(service.validateCreatePayload({ expiresInDays: 30 })).toEqual({
      expiresInDays: 30,
    });
  });

  it.each([
    [{ expiresInDays: 365 }],
    [{ expiresInDays: '7' }],
    [{ expiresInDays: 7, mailingId: 'x' }],
  ])('refuses %j', (body) => {
    expect(() => service.validateCreatePayload(body)).toThrow(
      expect.objectContaining({ status: 422, message: 'INVALID_SHARE_LINK' })
    );
  });
});

describe('creating a link', () => {
  it('stores a hash of an unguessable token, and returns the link once', async () => {
    ShareLinks.countDocuments.mockResolvedValue(0);
    ShareLinks.create.mockImplementation(async (doc) => ({
      _id: LINK_ID,
      createdAt: new Date(),
      ...doc,
    }));

    const { res } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
      body: { expiresInDays: 1 },
    });

    const stored = ShareLinks.create.mock.calls[0][0];
    const { url } = res.json.mock.calls[0][0];
    const token = url.split('/share/')[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored.tokenHash).toBe(service.hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    // The platform's own host over https, never the Host header outside
    // development.
    expect(url).toBe(`https://${config.host}/share/${token}`);
    expect(stored._company).toBe('c1');
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      23 * 3600 * 1000
    );
    expect(res.statusCode).toBe(201);
  });

  it('takes the right to edit the email', async () => {
    const forbidden = Object.assign(new Error('FORBIDDEN'), { status: 403 });
    mailingService.assertUserCanEditMailing.mockRejectedValue(forbidden);

    const { error } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
    });

    expect(error).toBe(forbidden);
    expect(ShareLinks.create).not.toHaveBeenCalled();
  });

  it('refuses when the company turned the preview links off', async () => {
    Groups.findById.mockReturnValue(
      lean({
        status: 'active',
        enableEmailBuilder: true,
        enableShareLinks: false,
      })
    );
    const { error } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
    });
    expect(error).toMatchObject({
      status: 403,
      message: 'SHARE_LINKS_DISABLED',
    });
    expect(Groups.findById.mock.calls[0][0]).toBe('c1');
    expect(ShareLinks.create).not.toHaveBeenCalled();
  });

  it('refuses for an inactive company, or one without the email builder', async () => {
    for (const group of [
      { status: 'inactive' },
      { status: 'active', enableEmailBuilder: false },
      null,
    ]) {
      Groups.findById.mockReturnValue(lean(group));
      const { error } = await call(controller.create, {
        params: { mailingId: MAILING_ID },
      });
      expect(error).toMatchObject({ status: 403 });
    }
    expect(ShareLinks.create).not.toHaveBeenCalled();
  });

  it("creates a link for the admin's email, which has no company", async () => {
    mailingService.findOneForUser.mockResolvedValue({ _id: MAILING_ID });
    ShareLinks.countDocuments.mockResolvedValue(0);
    ShareLinks.create.mockImplementation(async (doc) => ({
      _id: LINK_ID,
      ...doc,
    }));
    const { res } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
    });
    expect(Groups.findById).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('stops at 20 active links per email', async () => {
    ShareLinks.countDocuments.mockResolvedValue(20);
    const { error } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
    });
    expect(error).toMatchObject({
      status: 422,
      message: 'SHARE_LINKS_LIMIT_REACHED',
    });
  });
});

describe('listing and revoking', () => {
  it('lists the active links without any token', async () => {
    ShareLinks.find.mockReturnValue({
      sort: () => ({
        populate: () =>
          lean([
            {
              _id: LINK_ID,
              tokenHash: 'secret',
              createdAt: new Date('2026-09-01'),
              expiresAt: new Date('2026-09-08'),
              _user: { name: 'Ana' },
            },
          ]),
      }),
    });
    const { res } = await call(controller.list, {
      params: { mailingId: MAILING_ID },
    });
    const { items } = res.json.mock.calls[0][0];
    expect(items).toEqual([
      {
        id: LINK_ID,
        createdAt: new Date('2026-09-01'),
        expiresAt: new Date('2026-09-08'),
        createdBy: 'Ana',
        // No sealed token on this one: nothing to copy again.
        url: null,
      },
    ]);
    expect(JSON.stringify(items)).not.toContain('secret');
  });

  it('revokes a link of this email only', async () => {
    ShareLinks.findOneAndUpdate.mockResolvedValue(null);
    const { error } = await call(controller.revoke, {
      params: { mailingId: MAILING_ID, linkId: LINK_ID },
    });
    expect(ShareLinks.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: LINK_ID,
      _mailing: MAILING_ID,
    });
    expect(error).toMatchObject({ status: 404 });
  });

  it('revokes every active link of an email at once', async () => {
    ShareLinks.updateMany.mockResolvedValue({ nModified: 2 });
    await service.revokeAllForMailing(MAILING_ID);
    const [query, update] = ShareLinks.updateMany.mock.calls[0];
    expect(query).toMatchObject({ _mailing: MAILING_ID, revokedAt: null });
    expect(query.expiresAt.$gt).toBeInstanceOf(Date);
    expect(update.revokedAt).toBeInstanceOf(Date);
  });

  it('answers a malformed link id with a 404, not a cast error', async () => {
    const { error } = await call(controller.revoke, {
      params: { mailingId: MAILING_ID, linkId: 'nope' },
    });
    expect(error).toMatchObject({ status: 404 });
    expect(ShareLinks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('more on links', () => {
  it('revokes a link of this email', async () => {
    ShareLinks.findOneAndUpdate.mockResolvedValue({ _id: LINK_ID });
    const { res, error } = await call(controller.revoke, {
      params: { mailingId: MAILING_ID, linkId: LINK_ID },
    });
    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(204);
    expect(ShareLinks.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      revokedAt: null,
    });
  });

  it('counts only the links still open', async () => {
    ShareLinks.countDocuments.mockResolvedValue(0);
    ShareLinks.create.mockImplementation(async (doc) => ({
      _id: LINK_ID,
      ...doc,
    }));
    await call(controller.create, { params: { mailingId: MAILING_ID } });
    const query = ShareLinks.countDocuments.mock.calls[0][0];
    expect(query).toMatchObject({ _mailing: MAILING_ID, revokedAt: null });
    expect(query.expiresAt.$gt).toBeInstanceOf(Date);
  });

  it('stores no author for the admin, and says none', async () => {
    ShareLinks.countDocuments.mockResolvedValue(0);
    ShareLinks.create.mockImplementation(async (doc) => ({
      _id: LINK_ID,
      ...doc,
    }));
    const { res } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
      user: { id: 'admin', name: 'admin', isAdmin: true, lang: 'en' },
    });
    expect(ShareLinks.create.mock.calls[0][0]).toMatchObject({
      _user: undefined,
      lang: 'en',
    });
    expect(res.json.mock.calls[0][0].createdBy).toBeNull();
  });
});
