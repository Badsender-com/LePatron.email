'use strict';

// A share link opens an email to anyone who holds it, without an account. The
// token is the only credential: it must be unguessable, never stored as is,
// and the public page must serve nothing that can run.

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
// A key-independent stand-in for AES: what matters here is that the token is
// sealed, opened back, and never stored as is.
jest.mock('../../../packages/server/utils/crypto.js', () => ({
  encrypt: jest.fn((text) => `sealed:${Buffer.from(text).toString('hex')}`),
  decrypt: jest.fn((sealed) =>
    Buffer.from(sealed.replace('sealed:', ''), 'hex').toString()
  ),
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
  assertUserCanEditMailing: jest.fn(),
  sanitizePreviewCached: jest.fn((mailing) => `clean:${mailing.previewHtml}`),
}));

const {
  ShareLinks,
  Groups,
} = require('../../../packages/server/common/models.common.js');
const config = require('../../../packages/server/node.config.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const service = require('../../../packages/server/share-link/share-link.service.js');
const crypto = require('../../../packages/server/utils/crypto.js');
const controller = require('../../../packages/server/share-link/share-link.controller.js');

const MAILING_ID = '507f1f77bcf86cd799439001';
const LINK_ID = '507f1f77bcf86cd799439011';
const user = { id: '507f1f77bcf86cd799439099', name: 'Ana', lang: 'fr' };
const mailing = { _id: MAILING_ID, _company: 'c1' };

const lean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

function fakeRes() {
  const res = {
    headers: {},
    statusCode: 200,
    set: jest.fn((headers, value) =>
      Object.assign(
        res.headers,
        typeof headers === 'string' ? { [headers]: value } : headers
      )
    ),
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

  it('refuses what a form on another site could post', async () => {
    const { error } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
      is: () => false,
    });
    expect(error).toMatchObject({ status: 415 });
    expect(ShareLinks.create).not.toHaveBeenCalled();
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
        // Somebody else's link, and `user` is no administrator.
        canRevoke: false,
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

  it('answers a malformed link id with a 404, not a cast error', async () => {
    const { error } = await call(controller.revoke, {
      params: { mailingId: MAILING_ID, linkId: 'nope' },
    });
    expect(error).toMatchObject({ status: 404 });
    expect(ShareLinks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('who may turn a link off', () => {
  const ME = user.id;
  const listFor = async (requester, links) => {
    ShareLinks.find.mockReturnValue({
      sort: () => ({ populate: () => lean(links) }),
    });
    const { res } = await call(controller.list, {
      params: { mailingId: MAILING_ID },
      user: requester,
    });
    return res.json.mock.calls[0][0].items.map((item) => item.canRevoke);
  };
  const links = [
    { _id: 'mine', _user: { _id: ME, name: 'Ana' } },
    { _id: 'theirs', _user: { _id: 'other', name: 'Bob' } },
    { _id: 'admin-made', _user: null },
  ];

  it.each([
    ['a regular user', { ...user }],
    ['a writer', { ...user, role: 'writer' }],
    ['a reviewer', { ...user, role: 'reviewer' }],
  ])('offers %s only the links they made', async (_label, requester) => {
    expect(await listFor(requester, links)).toEqual([true, false, false]);
  });

  it.each([
    ['a company admin', { ...user, isGroupAdmin: true }],
    ['a tech company admin', { ...user, isGroupAdminTech: true }],
    ['a super admin', { ...user, isAdmin: true }],
  ])('offers %s every link, the admin-made ones included', async (_l, r) => {
    expect(await listFor(r, links)).toEqual([true, true, true]);
  });

  it('refuses an author-only user the link of somebody else, atomically', async () => {
    ShareLinks.findOneAndUpdate.mockResolvedValue(null);
    const { error } = await call(controller.revoke, {
      params: { mailingId: MAILING_ID, linkId: LINK_ID },
    });
    expect(ShareLinks.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: LINK_ID,
      _user: ME,
    });
    expect(error).toMatchObject({ status: 404 });
  });

  it('lets an administrator turn off any link of the email', async () => {
    ShareLinks.findOneAndUpdate.mockResolvedValue({ _id: LINK_ID });
    const { error } = await call(controller.revoke, {
      params: { mailingId: MAILING_ID, linkId: LINK_ID },
      user: { ...user, isGroupAdmin: true },
    });
    expect(error).toBeUndefined();
    expect(ShareLinks.findOneAndUpdate.mock.calls[0][0]).not.toHaveProperty(
      '_user'
    );
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

describe('copying a link again', () => {
  const TOKEN = 'T'.repeat(43);
  const listed = (docs) =>
    ShareLinks.find.mockReturnValue({
      sort: () => ({ populate: () => lean(docs) }),
    });

  it('stores the token sealed, and says the link can be copied again', async () => {
    ShareLinks.countDocuments.mockResolvedValue(0);
    ShareLinks.create.mockImplementation(async (doc) => ({
      _id: LINK_ID,
      ...doc,
    }));
    const { res } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
    });
    const stored = ShareLinks.create.mock.calls[0][0];
    const { url, copyable } = res.json.mock.calls[0][0];
    const token = url.split('/share/')[1];
    expect(stored.tokenEncrypted).toBe(crypto.encrypt(token));
    expect(copyable).toBe(true);
  });

  it('gives the editors the link of each active one', async () => {
    listed([
      { _id: LINK_ID, tokenEncrypted: crypto.encrypt(TOKEN), _user: null },
      { _id: 'old', _user: null },
    ]);
    const { res } = await call(controller.list, {
      params: { mailingId: MAILING_ID },
    });
    const { items } = res.json.mock.calls[0][0];
    expect(items[0].url).toBe(`https://${config.host}/share/${TOKEN}`);
    // Created before tokens were sealed: nothing to show again.
    expect(items[1].url).toBeNull();
    expect(res.headers['Cache-Control']).toContain('no-store');
    expect(JSON.stringify(items)).not.toContain('sealed:');
  });

  it('shows nothing for a token that does not open', async () => {
    crypto.decrypt.mockImplementationOnce(() => 'garbage');
    listed([{ _id: LINK_ID, tokenEncrypted: 'sealed:zz', _user: null }]);
    const { res } = await call(controller.list, {
      params: { mailingId: MAILING_ID },
    });
    expect(res.json.mock.calls[0][0].items[0].url).toBeNull();
  });

  it('still creates a link without a key, shown once', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    crypto.encrypt.mockImplementationOnce(() => {
      throw new Error('Invalid key length');
    });
    ShareLinks.countDocuments.mockResolvedValue(0);
    ShareLinks.create.mockImplementation(async (doc) => ({
      _id: LINK_ID,
      ...doc,
    }));
    const { res } = await call(controller.create, {
      params: { mailingId: MAILING_ID },
    });
    expect(ShareLinks.create.mock.calls[0][0].tokenEncrypted).toBeUndefined();
    expect(res.json.mock.calls[0][0]).toMatchObject({ copyable: false });
    console.warn.mockRestore();
  });
});
