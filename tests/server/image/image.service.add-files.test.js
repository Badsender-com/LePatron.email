'use strict';

// What an upload leaves in the gallery, and what the response says about it.
// The collection and the storage are in-memory fakes that answer the way
// MongoDB and the storage would (tests/helpers/fake-galleries.js): a file is
// listed as soon as its bytes are written, a new gallery is seeded from that
// listing, and a push is skipped when the name is already there.

jest.mock('node-fetch');
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../packages/server/common/models.common.js', () => {
  const { createFakeGalleries } = require('../../helpers/fake-galleries.js');
  const fake = createFakeGalleries();
  return { Galleries: fake.Galleries, mockGalleries: fake };
});
jest.mock('../../../packages/server/common/file-manage.service.js', () => {
  const { createFakeStorage } = require('../../helpers/fake-galleries.js');
  const formatName = require('../../../packages/server/helpers/format-filename-for-jquery-fileupload.js');
  const storage = createFakeStorage(formatName);
  return {
    list: storage.list,
    writeStreamFromStream: jest.fn(async (_source, name) =>
      storage.write(name)
    ),
    mockStorage: storage,
  };
});

const fetch = require('node-fetch');
const formatName = require('../../../packages/server/helpers/format-filename-for-jquery-fileupload.js');
const {
  Galleries,
  mockGalleries,
} = require('../../../packages/server/common/models.common.js');
const {
  mockStorage,
} = require('../../../packages/server/common/file-manage.service.js');
const imageService = require('../../../packages/server/image/image.service.js');

let sequence = 0;
// a fresh creation per test: the fakes keep what earlier tests stored
const newCreationId = () =>
  `507f1f77bcf86cd7994${String(++sequence).padStart(5, '0')}`;
const storedName = (id, hash = 'a') => `${id}-${hash.repeat(32)}.png`;

// What the upload parser hands over once the bytes are stored.
const upload = (name, uploadedName, size = 8) => ({
  ...formatName(name),
  originalName: 'mon-image.png',
  uploadedName,
  width: size,
  height: size,
});

// The gallery as GET /images/gallery/:id would read it.
async function readGallery(id) {
  const gallery = await Galleries.findOne({ creationOrWireframeId: id });
  return gallery ? Array.from(gallery.files) : [];
}

beforeEach(() => jest.clearAllMocks());

describe('imageService.addFiles', () => {
  // The upload parser writes the bytes before the gallery is created, so the
  // storage listing a new gallery is seeded from already holds the new file.
  it('keeps the label and the dimensions of the first upload into a new gallery', async () => {
    const id = newCreationId();
    const name = storedName(id);
    mockStorage.write(name);

    const [answered] = await imageService.addFiles(id, [
      upload(name, 'Mon Image.png'),
    ]);

    const [stored] = await readGallery(id);
    expect(stored).toMatchObject({
      name,
      label: 'Mon Image.png',
      width: 8,
      height: 8,
    });
    expect(answered).toEqual(stored);
  });

  // The stored name is the md5 of the content: the same bytes under another
  // name are the image the gallery already holds, and keep its label.
  it('answers with the entry already stored when the same bytes come back', async () => {
    const id = newCreationId();
    const name = storedName(id);
    await imageService.addFiles(id, [upload(name, 'Logo.png')]);

    const [answered] = await imageService.addFiles(id, [
      upload(name, 'Logo final.png'),
    ]);

    const stored = await readGallery(id);
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('Logo.png');
    expect(answered).toEqual(stored[0]);
  });

  it('appends each file in one atomic update, never by saving a read gallery', async () => {
    const id = newCreationId();
    await imageService.findOrCreateGallery(id);
    Galleries.mockClear();
    const names = [storedName(id, 'a'), storedName(id, 'b')];

    await imageService.addFiles(
      id,
      names.map((name) => upload(name, 'x.png'))
    );

    expect(Galleries).not.toHaveBeenCalled();
    names.forEach((name) =>
      expect(Galleries.updateOne).toHaveBeenCalledWith(
        { creationOrWireframeId: id, 'files.name': { $ne: name } },
        { $push: { files: expect.objectContaining({ name }) } }
      )
    );
    expect(await readGallery(id)).toHaveLength(2);
  });

  // The uploader slugs the stored file name and lowercases it. The label is
  // what the user reads and searches, so it keeps the name they chose.
  it('labels an upload with the name the user gave it, and stores it once', async () => {
    const id = newCreationId();
    const name = storedName(id);

    await imageService.addFiles(id, [upload(name, 'Mon Image.png')]);

    const [stored] = mockGalleries.storedFiles(id);
    expect(stored).toMatchObject({
      label: 'Mon Image.png',
      source: 'upload',
      externalMetadata: {},
    });
    // the names that only served to build the label are not stored: no
    // reader of the gallery uses them
    expect(stored).not.toHaveProperty('uploadedName');
    expect(stored).not.toHaveProperty('originalName');
  });

  it('falls back to the slug when no uploaded name reached the service', async () => {
    const id = newCreationId();
    const name = storedName(id);

    const [answered] = await imageService.addFiles(id, [
      { ...formatName(name), originalName: 'mon-image.png' },
    ]);

    expect(answered.label).toBe('mon-image.png');
  });
});

describe('imageService.storeInGallery', () => {
  // Parallel first uploads: if one request seeded the gallery after another
  // had written its bytes, that other image would be seeded under its
  // technical name and its own push skipped.
  it('keeps every label of parallel first uploads into a new gallery', async () => {
    const id = newCreationId();
    const names = [storedName(id, 'a'), storedName(id, 'b')];
    const store = (name, label) => async () => {
      mockStorage.write(name);
      return [upload(name, label)];
    };

    await Promise.all([
      imageService.storeInGallery(id, store(names[0], 'Premier.png')),
      imageService.storeInGallery(id, store(names[1], 'Second.png')),
    ]);

    const labels = (await readGallery(id)).map((file) => file.label);
    expect(labels.sort()).toEqual(['Premier.png', 'Second.png']);
  });

  it('creates the gallery before the bytes reach the storage', async () => {
    const id = newCreationId();
    let galleryWhenWriting;

    await imageService.storeInGallery(id, async () => {
      galleryWhenWriting = await Galleries.findOne({
        creationOrWireframeId: id,
      });
      mockStorage.write(storedName(id));
      return [upload(storedName(id), 'Mon Image.png')];
    });

    expect(galleryWhenWriting).not.toBeNull();
  });
});

describe('imageService.findOrCreateGallery', () => {
  // the first requests of a creation all find no gallery and all try to
  // create it: the unique index lets one through, the others read its gallery
  it('uses the gallery another request created in the meantime', async () => {
    const id = newCreationId();

    const [first, second] = await Promise.all([
      imageService.findOrCreateGallery(id),
      imageService.findOrCreateGallery(id),
    ]);

    expect(Galleries).toHaveBeenCalledTimes(2);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  });

  // Images found in storage are born with the V1 fields, but no upload date:
  // the gallery's own would be wrong for any of them added after it, and the
  // backfill script reads the real one from the stored file.
  it('seeds a new gallery from the storage listing, in the V1 shape, undated', async () => {
    const id = newCreationId();
    const name = storedName(id);
    mockStorage.write(name);

    await imageService.findOrCreateGallery(id);

    expect(mockGalleries.storedFiles(id)).toEqual([
      {
        ...formatName(name),
        label: name,
        source: 'upload',
        externalMetadata: {},
      },
    ]);
  });

  it('lets any other creation error through', async () => {
    Galleries.mockImplementationOnce(() => ({
      save: jest.fn().mockRejectedValue(new Error('db down')),
    }));

    await expect(
      imageService.findOrCreateGallery(newCreationId())
    ).rejects.toThrow('db down');
  });
});

describe('imageService.createFromUrl into a new gallery', () => {
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
    Buffer.from([0, 0, 0, 16, 0, 0, 0, 9]),
    Buffer.alloc(64),
  ]);

  beforeEach(() =>
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      buffer: () => Promise.resolve(png),
    })
  );

  it('stores what it answers: label and dimensions', async () => {
    const id = newCreationId();

    const answered = await imageService.createFromUrl(
      id,
      'https://cdn.example.com/photo.png'
    );

    const [stored] = await readGallery(id);
    expect(stored).toMatchObject({ width: 16, height: 9 });
    expect(answered).toEqual(stored);
  });

  // A search matches the label: the technical name would never be found.
  it.each([
    [
      'https://cdn.example.com/visuels/Mon%20Visuel.png?w=600',
      'Mon Visuel.png',
    ],
    // the resolved type names the extension, as for an upload
    ['https://cdn.example.com/photo.jpg', 'photo.png'],
    // cleaned like an uploaded name: no control or bidi characters
    ['https://cdn.example.com/a/%E2%80%AEgnp.exe', 'gnp.png'],
    // undecodable: kept as written rather than failing the import
    ['https://cdn.example.com/100%25%zz.png', '100%25%zz.png'],
  ])('labels %s with its file name: %s', async (url, label) => {
    const answered = await imageService.createFromUrl(newCreationId(), url);

    expect(answered.label).toBe(label);
  });

  it('falls back to the stored name when the URL names no file', async () => {
    const answered = await imageService.createFromUrl(
      newCreationId(),
      'https://cdn.example.com/'
    );

    expect(answered.label).toBe(answered.name);
  });
});
