'use strict';

jest.mock('node-fetch');
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  writeStreamFromStream: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../packages/server/common/models.common.js', () => {
  // a constructor (createGallery does `new Galleries()`) with the statics used
  const Galleries = jest.fn();
  Galleries.findOne = jest.fn();
  Galleries.updateOne = jest.fn();
  Galleries.findOneAndUpdate = jest.fn();
  return {
    Galleries,
    Mailings: { findOne: jest.fn() },
    Templates: { findOne: jest.fn() },
  };
});
jest.mock(
  '../../../packages/server/helpers/format-filename-for-jquery-fileupload.js',
  () => (name) => ({ name, url: `/img/${name}` })
);

const fetch = require('node-fetch');
const imageService = require('../../../packages/server/image/image.service.js');
const {
  assertOutboundHostAllowed,
} = require('../../../packages/server/utils/outbound-host.js');
const fileManager = require('../../../packages/server/common/file-manage.service.js');
const {
  Galleries,
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');

const MONGO_ID = 'abc123';
const IMAGE_URL = 'https://cdn.example.com/photo.png';

function mockImageResponse(
  buffer,
  { ok = true, status = 200, contentType = 'image/png' } = {}
) {
  fetch.mockResolvedValue({
    ok,
    status,
    headers: { get: () => contentType },
    buffer: () => Promise.resolve(buffer),
  });
}

// ---------------------------------------------------------------------------
// filterGalleryFiles — fonction pure, pas de mock DB nécessaire
// ---------------------------------------------------------------------------

const GALLERY_MONGO_ID = '6a212f21f802c2a6f99a4184';

const TEST_FILES = [
  {
    name: `${GALLERY_MONGO_ID}-aaa.jpg`,
    label: 'logo.jpg',
    uploadedAt: new Date('2026-01-01'),
  },
  {
    name: `${GALLERY_MONGO_ID}-bbb.jpeg`,
    label: 'banniere.jpeg',
    uploadedAt: new Date('2026-02-01'),
  },
  {
    name: `${GALLERY_MONGO_ID}-ccc.png`,
    label: 'icone.png',
    uploadedAt: null,
  },
  {
    name: `${GALLERY_MONGO_ID}-ddd.gif`,
    label: 'Animation.gif',
    uploadedAt: new Date('2026-03-01'),
  },
];

describe('imageService.filterGalleryFiles', () => {
  describe('sans paramètres', () => {
    it('retourne tous les fichiers', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {});
      expect(result).toHaveLength(TEST_FILES.length);
    });

    it('galerie vide → tableau vide', () => {
      const result = imageService.filterGalleryFiles([], { search: 'test' });
      expect(result).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('filtre par label (insensible à la casse)', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        search: 'LOGO',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('logo.jpg');
    });

    it('filtre par correspondance partielle', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        search: 'ani',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Animation.gif');
    });

    it('retourne un tableau vide si aucun résultat', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        search: 'inexistant',
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('format', () => {
    it('filtre jpg en minuscules', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
      });
      expect(result).toHaveLength(2); // .jpg + .jpeg
    });

    it('filtre jpg en majuscules (JPG)', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        format: 'JPG',
      });
      expect(result).toHaveLength(2);
    });

    it('jpeg est traité comme jpg', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
      });
      const names = result.map((f) => f.name);
      expect(names).toContain(`${GALLERY_MONGO_ID}-aaa.jpg`);
      expect(names).toContain(`${GALLERY_MONGO_ID}-bbb.jpeg`);
    });

    it('filtre png (casse mixte: Png)', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        format: 'Png',
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toContain('.png');
    });

    it('filtre gif (GIF en majuscules)', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        format: 'GIF',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Animation.gif');
    });
  });

  describe('sortBy', () => {
    it('date_desc: plus récent en premier', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        sortBy: 'date_desc',
      });
      expect(result[0].label).toBe('Animation.gif'); // 2026-03-01
      expect(result[1].label).toBe('banniere.jpeg'); // 2026-02-01
      expect(result[2].label).toBe('logo.jpg'); // 2026-01-01
      expect(result[3].label).toBe('icone.png'); // null → epoch → le plus ancien
    });

    it('date_asc: plus ancien en premier (null = epoch)', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        sortBy: 'date_asc',
      });
      expect(result[0].label).toBe('icone.png'); // null → epoch → le plus ancien
      expect(result[3].label).toBe('Animation.gif'); // 2026-03-01
    });
  });

  describe('combinaisons', () => {
    it('search + format', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        search: 'ban',
        format: 'jpg',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('banniere.jpeg');
    });

    it('format + sortBy', () => {
      const result = imageService.filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
        sortBy: 'date_desc',
      });
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('banniere.jpeg'); // 2026-02-01
      expect(result[1].label).toBe('logo.jpg'); // 2026-01-01
    });
  });
});

// ---------------------------------------------------------------------------
// createFromUrl
// ---------------------------------------------------------------------------

describe('image.service.createFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the SSRF guard on the image URL before downloading', async () => {
    mockImageResponse(Buffer.from('imagedata'));
    Galleries.findOne.mockResolvedValue({
      files: [],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    });

    await imageService.createFromUrl(MONGO_ID, IMAGE_URL);
    expect(assertOutboundHostAllowed).toHaveBeenCalledWith(IMAGE_URL);
  });

  it('does not fetch when the SSRF guard rejects', async () => {
    assertOutboundHostAllowed.mockRejectedValueOnce(new Error('blocked'));
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow('blocked');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws on a non-ok download', async () => {
    mockImageResponse(Buffer.from(''), { ok: false, status: 500 });
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow();
  });

  it('rejects an empty image', async () => {
    mockImageResponse(Buffer.alloc(0));
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow('empty');
  });

  it('rejects an image over the size cap', async () => {
    mockImageResponse(Buffer.alloc(10 * 1024 * 1024 + 1));
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow(/size/i);
  });

  it('stores the image and appends it to the gallery', async () => {
    mockImageResponse(Buffer.from('imagedata'));
    Galleries.findOne.mockResolvedValue({ files: [] });

    const result = await imageService.createFromUrl(MONGO_ID, IMAGE_URL);

    expect(fileManager.writeStreamFromStream).toHaveBeenCalledTimes(1);
    expect(result.name).toMatch(new RegExp(`^${MONGO_ID}-[a-f0-9]+\\.png$`));
    expect(Galleries.updateOne).toHaveBeenCalledWith(
      { creationOrWireframeId: MONGO_ID, 'files.name': { $ne: result.name } },
      { $push: { files: result } }
    );
  });
});

describe('image.service.addFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Uploads validated one after the other overlap on the server. Reading the
  // gallery and saving it back made every overlapping save but one fail with a
  // VersionError, and those images never reached the gallery.
  it('appends each file in one atomic update, never by saving a read gallery', async () => {
    const save = jest.fn();
    Galleries.findOne.mockResolvedValue({ files: [], save });
    const files = [
      { name: `${MONGO_ID}-a.png` },
      { name: `${MONGO_ID}-b.png` },
    ];

    await imageService.addFiles(MONGO_ID, files);

    expect(save).not.toHaveBeenCalled();
    expect(Galleries.updateOne).toHaveBeenCalledTimes(2);
    files.forEach((file) =>
      expect(Galleries.updateOne).toHaveBeenCalledWith(
        // the name filter skips a file the gallery already lists
        { creationOrWireframeId: MONGO_ID, 'files.name': { $ne: file.name } },
        { $push: { files: file } }
      )
    );
  });

  it('creates the gallery first when the creation has none yet', async () => {
    Galleries.findOne.mockResolvedValue(null);
    const save = jest.fn().mockResolvedValue({ files: [] });
    Galleries.mockImplementation(() => ({ save }));

    await imageService.addFiles(MONGO_ID, [{ name: `${MONGO_ID}-a.png` }]);

    expect(save).toHaveBeenCalledTimes(1);
    expect(Galleries.updateOne).toHaveBeenCalledTimes(1);
  });
});

describe('image.service.findOrCreateGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // the first uploads of a creation all find no gallery and all try to create
  // it: the unique index lets one through, the others must use its gallery
  it('uses the gallery another request created in the meantime', async () => {
    const createdMeanwhile = { files: [{ name: `${MONGO_ID}-a.png` }] };
    Galleries.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdMeanwhile);
    const duplicateKey = Object.assign(new Error('E11000'), { code: 11000 });
    Galleries.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(duplicateKey),
    }));

    await expect(imageService.findOrCreateGallery(MONGO_ID)).resolves.toBe(
      createdMeanwhile
    );
  });

  it('lets any other creation error through', async () => {
    Galleries.findOne.mockResolvedValue(null);
    Galleries.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(new Error('db down')),
    }));

    await expect(imageService.findOrCreateGallery(MONGO_ID)).rejects.toThrow(
      'db down'
    );
  });
});

describe('image.service.destroy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pulls the image by name in one atomic update', async () => {
    const gallery = { files: [] };
    Galleries.findOneAndUpdate.mockResolvedValue(gallery);

    await expect(
      imageService.destroy(MONGO_ID, `${MONGO_ID}-a.png`)
    ).resolves.toBe(gallery);
    expect(Galleries.findOneAndUpdate).toHaveBeenCalledWith(
      { creationOrWireframeId: MONGO_ID },
      { $pull: { files: { name: `${MONGO_ID}-a.png` } } },
      { new: true }
    );
  });

  it('answers NotFound when the creation has no gallery', async () => {
    Galleries.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      imageService.destroy(MONGO_ID, `${MONGO_ID}-a.png`)
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// renameLabel
// ---------------------------------------------------------------------------

describe('imageService.renameLabel', () => {
  const IMAGE_NAME = `${GALLERY_MONGO_ID}-hash.jpg`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('met à jour le label et sauvegarde la galerie', async () => {
    const mockFiles = [{ name: IMAGE_NAME, label: 'ancien.jpg' }];
    const mockGallery = {
      files: mockFiles,
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue({ files: mockFiles }),
    };
    Galleries.findOne.mockResolvedValue(mockGallery);

    await imageService.renameLabel(GALLERY_MONGO_ID, IMAGE_NAME, 'nouveau.jpg');

    expect(mockFiles[0].label).toBe('nouveau.jpg');
    expect(mockGallery.markModified).toHaveBeenCalledWith('files');
    expect(mockGallery.save).toHaveBeenCalled();
  });

  it('lève une erreur si la galerie est introuvable', async () => {
    Galleries.findOne.mockResolvedValue(null);

    await expect(
      imageService.renameLabel(GALLERY_MONGO_ID, IMAGE_NAME, 'label.jpg')
    ).rejects.toThrow('GALLERY_NOT_FOUND');
  });

  it("lève une erreur si l'image est introuvable dans la galerie", async () => {
    /* eslint-disable-line quotes */
    const mockGallery = {
      files: [{ name: 'autre-image.jpg', label: 'autre.jpg' }],
      markModified: jest.fn(),
      save: jest.fn(),
    };
    Galleries.findOne.mockResolvedValue(mockGallery);

    await expect(
      imageService.renameLabel(GALLERY_MONGO_ID, IMAGE_NAME, 'label.jpg')
    ).rejects.toThrow('GALLERY_IMAGE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// assertGalleryOwnership
// ---------------------------------------------------------------------------

describe('imageService.assertGalleryOwnership', () => {
  const user = { isAdmin: false, group: { id: 'group-1' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ne lève rien si un mailing du groupe possède la galerie', async () => {
    Mailings.findOne.mockResolvedValue({ _id: MONGO_ID });
    Templates.findOne.mockResolvedValue(null);

    await expect(
      imageService.assertGalleryOwnership(user, MONGO_ID)
    ).resolves.toBeUndefined();
  });

  it('ne lève rien si un template du groupe possède la galerie', async () => {
    Mailings.findOne.mockResolvedValue(null);
    Templates.findOne.mockResolvedValue({ _id: MONGO_ID });

    await expect(
      imageService.assertGalleryOwnership(user, MONGO_ID)
    ).resolves.toBeUndefined();
  });

  it('lève Forbidden si ni mailing ni template du groupe ne correspond', async () => {
    Mailings.findOne.mockResolvedValue(null);
    Templates.findOne.mockResolvedValue(null);

    await expect(
      imageService.assertGalleryOwnership(user, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
  });

  it("scope la requête au groupe de l'utilisateur (_company)", async () => {
    /* eslint-disable-line quotes */
    Mailings.findOne.mockResolvedValue({ _id: MONGO_ID });
    Templates.findOne.mockResolvedValue(null);

    await imageService.assertGalleryOwnership(user, MONGO_ID);

    expect(Mailings.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: MONGO_ID, _company: 'group-1' }),
      '_id'
    );
  });
});
