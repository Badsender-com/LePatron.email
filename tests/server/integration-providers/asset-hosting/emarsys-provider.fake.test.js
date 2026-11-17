'use strict';

// The Emarsys provider against the fake Emarsys of scripts/fake-emarsys.js, in
// real HTTP: the fake a developer tries an export with answers the provider
// as the provider expects. Both follow the Emarsys documentation; this pins
// that they agree, not that Emarsys does.

const fetch = require('node-fetch');
const config = require('../../../../packages/server/node.config.js');
const EmarsysProvider = require('../../../../packages/server/integration-providers/asset-hosting/emarsys-provider.js');
const { createFakeEmarsys } = require('../../../../scripts/fake-emarsys.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('the Emarsys provider against the fake Emarsys', () => {
  let fake;
  let previous;

  beforeAll(async () => {
    fake = await createFakeEmarsys({ port: 0 });
    previous = config.emarsysFakeUrl;
    config.emarsysFakeUrl = fake.base;
  });

  afterAll(async () => {
    config.emarsysFakeUrl = previous;
    await new Promise((resolve) => fake.server.close(resolve));
  });

  const provider = (secret = 'fake-secret') =>
    new EmarsysProvider({
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: secret,
      config: { clientId: 'fake-client', rootFolderId: 1000 },
    });

  it('accepts the fake credentials, and refuses others', async () => {
    await expect(provider().validateCredentials()).resolves.toBe(true);
    await expect(provider('wrong').validateCredentials()).resolves.toBe(false);
  });

  it('lists the folders of the fake account', async () => {
    const folders = await provider().listFolders();

    expect(folders).toEqual(
      expect.arrayContaining([
        { id: 1000, parent: 0, name: 'LePatron' },
        { id: 1002, parent: 1001, name: 'Emails' },
      ])
    );
  });

  it("puts an image in the email's folder, served at the URL it returns", async () => {
    const host = provider();

    const { id, url } = await host.putImage({
      folderName: 'soldes-ete-439055',
      filename: 'hero.png',
      content: PNG,
    });

    const folder = fake.state.folders.find(
      (f) => f.name === 'soldes-ete-439055'
    );
    expect(folder.parent).toBe(1000);
    expect(url).toBe(`${fake.base}/custloads/123/${id}_hero.png`);
    const served = Buffer.from(await (await fetch(url)).arrayBuffer());
    expect(served.equals(PNG)).toBe(true);
    await expect(host.findFile(id)).resolves.toMatchObject({
      id,
      folder: folder.id,
      url,
    });
  });

  it('no longer finds a file deleted from the fake Media Database', async () => {
    const host = provider();
    const { id } = await host.putImage({
      folderName: 'soldes-ete-439055',
      filename: 'logo.png',
      content: PNG,
    });

    fake.state.files.delete(id);

    await expect(host.findFile(id)).resolves.toBeNull();
  });

  it('asks one token for images put at the same time', async () => {
    const before = fake.state.counters.tokens;
    const host = provider();

    await Promise.all(
      ['a.png', 'b.png', 'c.png'].map((filename) =>
        host.putImage({ folderName: 'parallel', filename, content: PNG })
      )
    );

    expect(fake.state.counters.tokens - before).toBe(1);
    expect(
      fake.state.folders.filter((f) => f.name === 'parallel')
    ).toHaveLength(1);
  });

  // Emarsys allows 50 token requests a minute per client: a saved
  // integration keeps its token from one export to the next.
  it('shares the token of a saved integration across exports', async () => {
    const saved = (secret) =>
      new EmarsysProvider({
        _id: '507f1f77bcf86cd799439c01',
        type: 'asset_hosting',
        provider: 'emarsys',
        apiKey: secret,
        config: { clientId: 'fake-client', rootFolderId: 1000 },
      });
    const before = fake.state.counters.tokens;

    await saved('fake-secret').listFolders();
    await saved('fake-secret').listFolders();
    expect(fake.state.counters.tokens - before).toBe(1);

    // A changed secret is not answered with the former one's token.
    await expect(saved('wrong').validateCredentials()).resolves.toBe(false);
  });
});
