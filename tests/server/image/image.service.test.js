'use strict';

jest.mock('../../../packages/server/common/models.common', () => ({
  Galleries: {
    findOne: jest.fn(),
  },
}));

const imageService = require('../../../packages/server/image/image.service');
const { Galleries } = require('../../../packages/server/common/models.common');

// ---------------------------------------------------------------------------
// filterGalleryFiles — fonction pure, pas de mock DB nécessaire
// ---------------------------------------------------------------------------

const MONGO_ID = '6a212f21f802c2a6f99a4184';

const TEST_FILES = [
  {
    name: `${MONGO_ID}-aaa.jpg`,
    label: 'logo.jpg',
    uploadedAt: new Date('2026-01-01'),
  },
  {
    name: `${MONGO_ID}-bbb.jpeg`,
    label: 'banniere.jpeg',
    uploadedAt: new Date('2026-02-01'),
  },
  {
    name: `${MONGO_ID}-ccc.png`,
    label: 'icone.png',
    uploadedAt: null,
  },
  {
    name: `${MONGO_ID}-ddd.gif`,
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
      expect(names).toContain(`${MONGO_ID}-aaa.jpg`);
      expect(names).toContain(`${MONGO_ID}-bbb.jpeg`);
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
// renameLabel
// ---------------------------------------------------------------------------

describe('imageService.renameLabel', () => {
  const IMAGE_NAME = `${MONGO_ID}-hash.jpg`;

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

    await imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'nouveau.jpg');

    expect(mockFiles[0].label).toBe('nouveau.jpg');
    expect(mockGallery.markModified).toHaveBeenCalledWith('files');
    expect(mockGallery.save).toHaveBeenCalled();
  });

  it('lève une erreur si la galerie est introuvable', async () => {
    Galleries.findOne.mockResolvedValue(null);

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'label.jpg')
    ).rejects.toThrow('Gallery not found');
  });

  it('lève une erreur si l\'image est introuvable dans la galerie', async () => {
    /* eslint-disable-line quotes */
    const mockGallery = {
      files: [{ name: 'autre-image.jpg', label: 'autre.jpg' }],
      markModified: jest.fn(),
      save: jest.fn(),
    };
    Galleries.findOne.mockResolvedValue(mockGallery);

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'label.jpg')
    ).rejects.toThrow('Image not found');
  });
});
