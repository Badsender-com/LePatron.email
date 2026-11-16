'use strict';

// The rules that say who may reach a gallery, played on the service alone.
// Every role, through the real routes, is in image.routes.gallery-rights.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findOne: jest.fn() },
  Templates: { findOne: jest.fn() },
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  userCanEditMailing: jest.fn(),
  userCanReadMailing: jest.fn(),
}));

const galleryAccess = require('../../../packages/server/image/gallery-access.js');
const {
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');

const MONGO_ID = '6a212f21f802c2a6f99a4184';
const user = { role: 'regular_user', group: { id: 'group-1' } };
const superAdmin = { role: 'super_admin', group: { id: 'platform' } };
const mailing = { _id: MONGO_ID, _workspace: 'workspace-1' };

beforeEach(() => {
  jest.clearAllMocks();
  Mailings.findOne.mockResolvedValue(null);
  Templates.findOne.mockResolvedValue(null);
});

describe.each([
  ['assertCanReadGallery', 'userCanReadMailing'],
  ['assertCanWriteGallery', 'userCanEditMailing'],
])('galleryAccess.%s', (assertion, mailingRule) => {
  it(`asks the email's own rule (${mailingRule}) for the gallery of an email`, async () => {
    Mailings.findOne.mockResolvedValue(mailing);
    mailingService[mailingRule].mockResolvedValue(true);

    await expect(
      galleryAccess[assertion](user, MONGO_ID)
    ).resolves.toBeUndefined();
    expect(mailingService[mailingRule]).toHaveBeenCalledWith(user, mailing);
  });

  it('raises Forbidden when that rule refuses the email', async () => {
    Mailings.findOne.mockResolvedValue(mailing);
    mailingService[mailingRule].mockResolvedValue(false);

    await expect(galleryAccess[assertion](user, MONGO_ID)).rejects.toThrow(
      'FORBIDDEN_GALLERY_ACCESS'
    );
  });

  it("reads the parent in the user's company only", async () => {
    await galleryAccess[assertion](user, MONGO_ID).catch(() => {});

    expect(Mailings.findOne).toHaveBeenCalledWith(
      { _id: MONGO_ID, _company: 'group-1' },
      '_id _workspace _parentFolder'
    );
    expect(Templates.findOne).toHaveBeenCalledWith(
      { _id: MONGO_ID, _company: 'group-1' },
      '_id'
    );
  });

  it("lets the users of a template's company reach its gallery", async () => {
    Templates.findOne.mockResolvedValue({ _id: MONGO_ID });

    await expect(
      galleryAccess[assertion](user, MONGO_ID)
    ).resolves.toBeUndefined();
  });

  it('raises Forbidden when neither a mailing nor a template matches', async () => {
    await expect(
      galleryAccess[assertion](superAdmin, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
  });
});

describe('galleryAccess.assertCanEditGallery', () => {
  it("asks the email's own write rule for the gallery of an email", async () => {
    Mailings.findOne.mockResolvedValue(mailing);
    mailingService.userCanEditMailing.mockResolvedValue(true);

    await expect(
      galleryAccess.assertCanEditGallery(user, MONGO_ID)
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
      galleryAccess.assertCanEditGallery(user, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
  });

  it('reads what the rule needs: the workspace and the folder', async () => {
    await galleryAccess.assertCanEditGallery(user, MONGO_ID).catch(() => {});

    expect(Mailings.findOne).toHaveBeenCalledWith(
      { _id: MONGO_ID, _company: 'group-1' },
      '_id _workspace _parentFolder'
    );
  });

  it('lets only who edits templates rename in the gallery of a template', async () => {
    Templates.findOne.mockResolvedValue({ _id: MONGO_ID });

    await expect(
      galleryAccess.assertCanEditGallery(user, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
    await expect(
      galleryAccess.assertCanEditGallery(superAdmin, MONGO_ID)
    ).resolves.toBeUndefined();
  });

  it('raises Forbidden when neither a mailing nor a template matches', async () => {
    await expect(
      galleryAccess.assertCanEditGallery(superAdmin, MONGO_ID)
    ).rejects.toThrow('FORBIDDEN_GALLERY_ACCESS');
  });
});
