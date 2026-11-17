'use strict';

// The export to an image host (ADR 0028): it puts every image of the email on
// the host, and gives the HTML the ZIP holds alone, every image pointing at
// the URL the host gave.
//
// Driven through `mailingService.prepareImageHostExport`, which the export job
// starts with and runs (ADR 0029, tested with the job).
// The image host is faked behind the provider factory: its contract with
// Emarsys is tested with the provider. The sources of the images are faked
// behind node-fetch. The stores (emails, companies, integrations, hosted
// images) are faked in memory below.

jest.mock('node-fetch');
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
  Integrations: {
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(() => ({ then: (resolve) => resolve({}) })),
  },
  HostedImages: {},
}));
jest.mock(
  '../../../packages/server/integration-providers/provider-factory.js',
  () => ({ createProvider: jest.fn() })
);

const fetch = require('node-fetch');
const mongoose = require('mongoose');
const models = require('../../../packages/server/common/models.common.js');
const ProviderFactory = require('../../../packages/server/integration-providers/provider-factory.js');

const COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');
const OTHER_COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439b01');
const INTEGRATION = mongoose.Types.ObjectId('507f1f77bcf86cd799439c01');
const user = { id: 'user-1', group: { id: String(COMPANY) } };

const HERO = 'https://lepatron.example.com/api/images/hero-5f3a.png';
const LOGO = 'https://cdn.client.example.com/brand/logo.gif';

/** A query that resolves to `value`, whatever chain the caller puts on it. */
function query(value) {
  const chain = {
    lean: () => chain,
    select: () => chain,
    populate: () => chain,
    exec: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
}

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && !(value instanceof Buffer)) {
      if (mongoose.isValidObjectId(value)) {
        return String(doc[key]) === String(value);
      }
      return matches(doc[key] || {}, value);
    }
    return String(doc[key]) === String(value);
  });

/** The hosted images, kept in memory between the exports of one test. */
function hostedImageStore() {
  const docs = [];
  Object.assign(models.HostedImages, {
    docs,
    findOne: jest.fn((filter) =>
      query(docs.find((d) => matches(d, filter)) || null)
    ),
    find: jest.fn((filter = {}) =>
      query(docs.filter((d) => matches(d, filter)))
    ),
    create: jest.fn(async (doc) => {
      const created = { _id: mongoose.Types.ObjectId(), ...doc };
      docs.push(created);
      return created;
    }),
    updateOne: jest.fn((filter, update) => {
      const doc = docs.find((d) => matches(d, filter));
      if (doc) Object.assign(doc, update.$set || update);
      return query({ matchedCount: doc ? 1 : 0 });
    }),
    deleteOne: jest.fn((filter) => {
      const index = docs.findIndex((d) => matches(d, filter));
      if (index >= 0) docs.splice(index, 1);
      return query({ deletedCount: index >= 0 ? 1 : 0 });
    }),
  });
  return docs;
}

/**
 * The image host the integration stands for: what it holds and received.
 * Its folders are named after the email under `host.root`, which a test
 * changes as a tech admin would change the root folder.
 */
function fakeImageHost() {
  const host = { files: {}, puts: [], root: 'root-a' };
  let nextId = 1;
  const folderOf = (folderName) => `${host.root}/${folderName}`;
  host.emailFolderId = jest.fn(async (folderName) => folderOf(folderName));
  host.putImage = jest.fn(async ({ folderName, filename, content }) => {
    const id = String(nextId++);
    const url = `https://link.example.net/custloads/123/${id}_${filename}`;
    host.files[id] = { folder: folderOf(folderName), filename, content, url };
    host.puts.push({ folderName, filename, content });
    return { id, url };
  });
  host.findFile = jest.fn(async (id) =>
    host.files[id]
      ? { id, folder: host.files[id].folder, url: host.files[id].url }
      : null
  );
  ProviderFactory.createProvider.mockReturnValue(host);
  return host;
}

/** An error of the host, as the provider raises them. */
function hostError(status, code = 'PROVIDER_API_ERROR') {
  const {
    ProviderError,
  } = require('../../../packages/server/integration-providers/provider-error.js');
  const error = new ProviderError(`host answered ${status}`, code);
  error.status = status;
  return error;
}

/** The images the HTML loads, by URL. Anything else answers 404. */
function sources(images) {
  fetch.mockImplementation(async (url) => {
    const content = images[url];
    if (!content) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => 'text/plain' },
        buffer: () => Promise.resolve(Buffer.from('')),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      buffer: () => Promise.resolve(content),
      arrayBuffer: () =>
        Promise.resolve(
          content.buffer.slice(
            content.byteOffset,
            content.byteOffset + content.byteLength
          )
        ),
    };
  });
}

function integration(overrides = {}) {
  return {
    _id: INTEGRATION,
    id: String(INTEGRATION),
    name: 'Emarsys – Brand A',
    type: 'asset_hosting',
    provider: 'emarsys',
    _company: COMPANY,
    isActive: true,
    validationStatus: 'valid',
    apiKey: 'secret',
    config: { clientId: 'client-123', rootFolderId: 4200 },
    ...overrides,
  };
}

function givenIntegration(overrides) {
  const doc = integration(overrides);
  models.Integrations.findById.mockImplementation(() => query(doc));
  models.Integrations.findOne.mockImplementation((filter) =>
    query(matches(doc, filter) ? doc : null)
  );
}

function mailing({
  id = '507f1f77bcf86cd799439055',
  name = 'Soldes été',
} = {}) {
  return {
    _id: mongoose.Types.ObjectId(id),
    id,
    name,
    _company: COMPANY,
    _wireframe: { _id: 'tpl', _company: COMPANY },
    _doc: { data: {} },
  };
}

const HTML = `<html><body>
<img src="${HERO}" alt="">
<table background="${LOGO}"><tr><td>Hello</td></tr></table>
</body></html>`;

describe('downloading the ZIP with an image host', () => {
  let mailingService;

  beforeAll(() => {
    mailingService = require('../../../packages/server/mailing/mailing.service.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    hostedImageStore();
    models.Groups.findById.mockImplementation((id) =>
      query({ _id: id, name: 'Company A' })
    );
    givenIntegration();
    sources({
      [HERO]: Buffer.from('hero-bytes'),
      [LOGO]: Buffer.from('logo-bytes'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Runs the export; resolves with what the ZIP holds. */
  async function exportZip({
    email = mailing(),
    html = HTML,
    options = { hostingIntegrationId: String(INTEGRATION) },
  } = {}) {
    jest
      .spyOn(mailingService, 'getMailByMailingIdAndUser')
      .mockResolvedValue(email);
    const prepared = await mailingService.prepareImageHostExport({
      mailingId: email.id,
      html,
      user,
      ...options,
    });
    const { prefix, name, html: exported } = await prepared.run();
    // What the ZIP of the job holds (ADR 0029).
    return [{ path: `${prefix}${name}.html`, content: exported }];
  }

  it('returns a ZIP holding the HTML alone', async () => {
    fakeImageHost();

    const entries = await exportZip();

    expect(entries.map((e) => e.path)).toEqual(['soldes-ete/soldes-ete.html']);
  });

  it('points every image at the URL the image host gave for it', async () => {
    const host = fakeImageHost();

    const [{ content: html }] = await exportZip();

    const urls = Object.values(host.files).map((f) => f.url);
    expect(urls).toHaveLength(2);
    urls.forEach((url) => expect(html).toContain(url));
    expect(html).not.toContain(HERO);
    expect(html).not.toContain(LOGO);
  });

  it('puts the images of other hosts there too, as the FTP export does', async () => {
    const host = fakeImageHost();

    await exportZip();

    const contents = host.puts.map((p) => p.content.toString());
    expect(contents.sort()).toEqual(['hero-bytes', 'logo-bytes']);
  });

  it('puts the images in a folder named after the email and a short identifier', async () => {
    const host = fakeImageHost();

    await exportZip();

    const folders = [...new Set(host.puts.map((p) => p.folderName))];
    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatch(/^soldes-ete-[0-9a-z]{4,}$/);
  });

  it('gives two emails of the same name two folders', async () => {
    const host = fakeImageHost();

    await exportZip({ email: mailing({ id: '507f1f77bcf86cd799439055' }) });
    await exportZip({ email: mailing({ id: '507f1f77bcf86cd799439066' }) });

    const folders = new Set(host.puts.map((p) => p.folderName));
    expect(folders.size).toBe(2);
  });

  it('fails as a whole, naming the image, when the host refuses one', async () => {
    const host = fakeImageHost();
    const put = host.putImage.getMockImplementation();
    host.putImage.mockImplementation(async (image) => {
      if (image.content.toString() === 'logo-bytes') {
        throw new Error('File too large');
      }
      return put(image);
    });

    const failure = exportZip();

    await expect(failure).rejects.toMatchObject({
      message: 'IMAGE_HOST_UPLOAD_FAILED',
      images: [LOGO],
    });
  });

  it('fails as a whole, naming the image, when its source cannot be read', async () => {
    fakeImageHost();
    sources({ [HERO]: Buffer.from('hero-bytes') });

    await expect(exportZip()).rejects.toMatchObject({
      message: 'IMAGE_HOST_UPLOAD_FAILED',
      images: [LOGO],
    });
  });

  // The root folder deleted in Emarsys: no image is at fault.
  it('says when the email folder cannot be found or created, naming no image', async () => {
    const host = fakeImageHost();
    host.emailFolderId.mockRejectedValue(hostError(400));

    const failure = await exportZip().catch((error) => error);

    expect(failure.message).toBe('IMAGE_HOST_FOLDER_UNAVAILABLE');
    expect(failure.images).toBeUndefined();
    expect(host.putImage).not.toHaveBeenCalled();
  });

  it.each([
    ['failing', 503],
    ['overloaded', 429],
    ['unreachable', undefined],
  ])(
    'says when the image host is %s, naming no image',
    async (_label, status) => {
      const host = fakeImageHost();
      host.putImage.mockRejectedValue(hostError(status));

      const failure = await exportZip().catch((error) => error);

      expect(failure.message).toBe('IMAGE_HOST_UNAVAILABLE');
      expect(failure.images).toBeUndefined();
    }
  );

  // Every image would fail alike: the export says the connection is refused,
  // and the integration leaves the export menu until a tech admin tests it.
  it('stops at refused credentials, and marks the image host invalid', async () => {
    const host = fakeImageHost();
    const {
      ProviderError,
      PROVIDER_ERROR_CODES,
    } = require('../../../packages/server/integration-providers/provider-error.js');
    host.putImage.mockRejectedValue(
      new ProviderError(
        'Emarsys token request failed: 401',
        PROVIDER_ERROR_CODES.INVALID_CREDENTIALS
      )
    );

    const failure = await exportZip().catch((error) => error);

    expect(failure.message).toBe('IMAGE_HOST_CREDENTIALS_REFUSED');
    // The images are not at fault: none is named.
    expect(failure.images).toBeUndefined();
    expect(models.Integrations.updateOne).toHaveBeenCalledWith(
      { _id: INTEGRATION },
      { $set: { validationStatus: 'invalid' } }
    );
  });

  it.each([
    ['of another company', { _company: OTHER_COMPANY }],
    ['switched off', { isActive: false }],
    ['whose last validation failed', { validationStatus: 'invalid' }],
    ['never validated', { validationStatus: 'pending' }],
    ['that is not an image host', { type: 'ai', provider: 'openai' }],
  ])(
    'refuses an integration %s, and puts nothing',
    async (_label, overrides) => {
      const host = fakeImageHost();
      givenIntegration(overrides);

      await expect(exportZip()).rejects.toThrow('IMAGE_HOST_NOT_AVAILABLE');
      expect(host.putImage).not.toHaveBeenCalled();
    }
  );
});

describe('exporting the same email again to an image host', () => {
  let mailingService;
  let store;

  beforeAll(() => {
    mailingService = require('../../../packages/server/mailing/mailing.service.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    store = hostedImageStore();
    models.Groups.findById.mockImplementation((id) =>
      query({ _id: id, name: 'Company A' })
    );
    givenIntegration();
    sources({
      [HERO]: Buffer.from('hero-bytes'),
      [LOGO]: Buffer.from('logo-bytes'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function exportZip(email = mailing()) {
    jest
      .spyOn(mailingService, 'getMailByMailingIdAndUser')
      .mockResolvedValue(email);
    const prepared = await mailingService.prepareImageHostExport({
      mailingId: email.id,
      html: HTML,
      user,
      hostingIntegrationId: String(INTEGRATION),
    });
    return (await prepared.run()).html;
  }

  it('puts nothing again when nothing changed, and gives the same HTML', async () => {
    const host = fakeImageHost();

    const first = await exportZip();
    const second = await exportZip();

    expect(host.putImage).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
  });

  it('puts back an image someone deleted from the host', async () => {
    const host = fakeImageHost();
    await exportZip();
    const [heroId] = Object.entries(host.files).find(
      ([, f]) => f.content.toString() === 'hero-bytes'
    );
    delete host.files[heroId];

    const html = await exportZip();

    expect(host.putImage).toHaveBeenCalledTimes(3);
    const newHero = Object.values(host.files).find(
      (f) => f.content.toString() === 'hero-bytes'
    );
    expect(html).toContain(newHero.url);
  });

  // A campaign already sent keeps pointing at the image it was sent with.
  it('puts a changed image as a new file, under a new URL', async () => {
    const host = fakeImageHost();
    const first = await exportZip();
    sources({
      [HERO]: Buffer.from('hero-bytes, cropped'),
      [LOGO]: Buffer.from('logo-bytes'),
    });

    const second = await exportZip();

    expect(host.putImage).toHaveBeenCalledTimes(3);
    const urls = Object.values(host.files).map((f) => f.url);
    expect(urls).toHaveLength(3);
    const firstHero = Object.values(host.files).find(
      (f) => f.content.toString() === 'hero-bytes'
    );
    expect(first).toContain(firstHero.url);
    expect(second).not.toContain(firstHero.url);
  });

  it('puts once an image loaded under two names', async () => {
    const host = fakeImageHost();
    sources({
      [HERO]: Buffer.from('same-bytes'),
      [LOGO]: Buffer.from('same-bytes'),
    });

    const html = await exportZip();

    expect(host.putImage).toHaveBeenCalledTimes(1);
    const [{ url }] = Object.values(host.files);
    expect(html.split(url)).toHaveLength(3);
  });

  // The folder follows the email's name: a renamed email gets all of its
  // images in its new folder, not the new ones alone.
  it('puts the images again in the folder of a renamed email', async () => {
    const host = fakeImageHost();
    await exportZip(mailing({ name: 'Soldes été' }));

    await exportZip(mailing({ name: 'Soldes hiver' }));

    expect(host.putImage).toHaveBeenCalledTimes(4);
    const lastFolders = host.puts.slice(2).map((put) => put.folderName);
    expect(new Set(lastFolders)).toEqual(new Set(['soldes-hiver-439055']));
  });

  it('puts the images again under a changed root folder', async () => {
    const host = fakeImageHost();
    await exportZip();
    host.root = 'root-b';

    await exportZip();

    expect(host.putImage).toHaveBeenCalledTimes(4);
  });

  it('never shares a hosted image between two emails', async () => {
    const host = fakeImageHost();

    await exportZip(mailing({ id: '507f1f77bcf86cd799439055' }));
    await exportZip(mailing({ id: '507f1f77bcf86cd799439066' }));

    expect(host.putImage).toHaveBeenCalledTimes(4);
    expect(store.length).toBe(4);
  });
});
