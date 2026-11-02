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
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  userCanEditMailing: jest.fn(),
}));

const imageService = require('../../../packages/server/image/image.service.js');
const {
  Galleries,
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');

const MONGO_ID = '6a212f21f802c2a6f99a4184';

// ---------------------------------------------------------------------------
// renameLabel
// ---------------------------------------------------------------------------

describe('imageService.renameLabel', () => {
  const IMAGE_NAME = `${MONGO_ID}-hash.jpg`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renames the label in a single atomic update', async () => {
    const gallery = { files: [{ name: IMAGE_NAME, label: 'nouveau.jpg' }] };
    Galleries.findOneAndUpdate.mockResolvedValue(gallery);

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'nouveau.jpg')
    ).resolves.toBe(gallery);

    expect(Galleries.findOneAndUpdate).toHaveBeenCalledWith(
      { creationOrWireframeId: MONGO_ID, 'files.name': IMAGE_NAME },
      { $set: { 'files.$.label': 'nouveau.jpg' } },
      // only the renamed image comes back, not the whole gallery
      { new: true, projection: { files: { $elemMatch: { name: IMAGE_NAME } } } }
    );
    // no read-modify-save: a concurrent upload can't be overwritten
    expect(Galleries.findOne).not.toHaveBeenCalled();
  });

  it('raises GALLERY_NOT_FOUND when the gallery does not exist', async () => {
    Galleries.findOneAndUpdate.mockResolvedValue(null);
    Galleries.exists.mockResolvedValue(null);

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'label.jpg')
    ).rejects.toThrow('GALLERY_NOT_FOUND');
  });

  it('raises GALLERY_IMAGE_NOT_FOUND when the image is not in the gallery', async () => {
    Galleries.findOneAndUpdate.mockResolvedValue(null);
    Galleries.exists.mockResolvedValue({ _id: 'gallery-1' });

    await expect(
      imageService.renameLabel(MONGO_ID, IMAGE_NAME, 'label.jpg')
    ).rejects.toThrow('GALLERY_IMAGE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// assertCanEditGallery
// ---------------------------------------------------------------------------

describe('imageService.assertCanEditGallery', () => {
  const user = { role: 'regular_user', group: { id: 'group-1' } };
  const superAdmin = { role: 'super_admin', group: { id: 'platform' } };
  const mailing = { _id: MONGO_ID, _workspace: 'workspace-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    Mailings.findOne.mockResolvedValue(null);
    Templates.findOne.mockResolvedValue(null);
  });

  it("asks the email's own write rule for the gallery of an email", async () => {
    Mailings.findOne.mockResolvedValue(mailing);
    mailingService.userCanEditMailing.mockResolvedValue(true);

    await expect(
      imageService.assertCanEditGallery(user, MONGO_ID)
    ).resolves.toBeUndefined();
    expect(mailingService.userCanEditMailing).toHaveBeenCalledWith(
      user,
      mailing
    );
  });

  it('raises Forbidden when that rule refuses the email', async () => {
    Mailings.findOne.mockResolvedValue(mailing);
    mailingService.userCanEditMailing.mockResolvedValue(false);

    await expect(
      imageService.assertCanEditGallery(user, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
  });

  it('reads what the rule needs: the workspace and the folder', async () => {
    await imageService.assertCanEditGallery(user, MONGO_ID).catch(() => {});

    expect(Mailings.findOne).toHaveBeenCalledWith(
      { _id: MONGO_ID, _company: 'group-1' },
      '_id _workspace _parentFolder'
    );
  });

  it('lets only who edits templates rename in the gallery of a template', async () => {
    Templates.findOne.mockResolvedValue({ _id: MONGO_ID });

    await expect(
      imageService.assertCanEditGallery(user, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
    await expect(
      imageService.assertCanEditGallery(superAdmin, MONGO_ID)
    ).resolves.toBeUndefined();
  });

  it('raises Forbidden when neither a mailing nor a template matches', async () => {
    await expect(
      imageService.assertCanEditGallery(superAdmin, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
  });
});
