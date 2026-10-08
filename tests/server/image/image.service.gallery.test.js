'use strict';

jest.mock('../../../packages/server/common/models.common.js', () => ({
  CacheImages: {},
  Galleries: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
  },
  Mailings: {
    findOne: jest.fn(),
  },
  Templates: {
    findOne: jest.fn(),
  },
}));

const imageService = require('../../../packages/server/image/image.service.js');
const {
  Galleries,
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');

const MONGO_ID = '6a212f21f802c2a6f99a4184';

// ---------------------------------------------------------------------------
// renameLabel
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// renameLabel
// ---------------------------------------------------------------------------

describe('imageService.renameLabel', () => {
  const IMAGE_NAME = `${MONGO_ID}-hash.jpg`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renomme le libellé en une seule mise à jour atomique', async () => {
    const gallery = { files: [{ name: IMAGE_NAME, label: 'nouveau.jpg' }] };
    Galleries.findOneAndUpdate.mockResolvedValue(gallery);

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'nouveau.jpg')
    ).resolves.toBe(gallery);

    expect(Galleries.findOneAndUpdate).toHaveBeenCalledWith(
      { creationOrWireframeId: MONGO_ID, 'files.name': IMAGE_NAME },
      { $set: { 'files.$.label': 'nouveau.jpg' } },
      { new: true }
    );
    // no read-modify-save: a concurrent upload can't be overwritten
    expect(Galleries.findOne).not.toHaveBeenCalled();
  });

  it('lève GALLERY_NOT_FOUND si la galerie est introuvable', async () => {
    Galleries.findOneAndUpdate.mockResolvedValue(null);
    Galleries.exists.mockResolvedValue(null);

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'label.jpg')
    ).rejects.toThrow('GALLERY_NOT_FOUND');
  });

  it("lève GALLERY_IMAGE_NOT_FOUND si l'image n'est pas dans la galerie", async () => {
    Galleries.findOneAndUpdate.mockResolvedValue(null);
    Galleries.exists.mockResolvedValue({ _id: 'gallery-1' });

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'label.jpg')
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
    Mailings.findOne.mockResolvedValue({ _id: MONGO_ID });
    Templates.findOne.mockResolvedValue(null);

    await imageService.assertGalleryOwnership(user, MONGO_ID);

    expect(Mailings.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: MONGO_ID, _company: 'group-1' }),
      '_id'
    );
  });
});
