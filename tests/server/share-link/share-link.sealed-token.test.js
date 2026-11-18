'use strict';

// The token of a link is kept sealed with the platform's key, so that the
// editors can copy the link again; without a key, the link is shown once.

const {
  ShareLinks,
  MAILING_ID,
  LINK_ID,
  lean,
  call,
  resetMocks,
} = require('./share-link.harness.js');
const config = require('../../../packages/server/node.config.js');
const crypto = require('../../../packages/server/utils/crypto.js');
const controller = require('../../../packages/server/share-link/share-link.controller.js');

beforeEach(resetMocks);

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
