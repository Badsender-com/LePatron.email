'use strict';

// The editor shows the "Share a preview" section only when the mailing's
// metadata carries the address of its links: a company that turned the
// preview links off must get no address, and the limit the panel quotes
// comes from the server, not from a copy of it.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn().mockResolvedValue(null),
}));
jest.mock(
  '../../../packages/server/mailing/mailing-metadata.service.js',
  () => ({ buildEditorMetadata: jest.fn().mockResolvedValue(null) })
);
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {},
  Groups: { findById: jest.fn() },
  ShareLinks: {},
}));

const mongoose = require('mongoose');
const { Groups } = require('../../../packages/server/common/models.common.js');
const GroupSchema = require('../../../packages/server/group/group.schema.js');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');
const {
  GroupModel,
} = require('../../../packages/server/constant/model.names.js');
const {
  MAX_ACTIVE_LINKS,
} = require('../../../packages/server/share-link/share-link.service.js');

const MAILING_ID = mongoose.Types.ObjectId('507f1f77bcf86cd799439055');

// The companies as the database holds them, by id; the template's is c1.
function metadataFor(companies, mailingOverrides = {}) {
  const mailing = {
    _id: MAILING_ID,
    name: 'Campagne',
    data: {},
    previewHtml: '',
    _workspace: mongoose.Types.ObjectId('507f1f77bcf86cd799439301'),
    _wireframe: { _id: 'tpl', _company: 'c1', assets: {} },
    ...mailingOverrides,
  };
  const model = {
    findOne: () => ({
      populate: () => ({ populate: () => Promise.resolve(mailing) }),
    }),
  };
  mongoose.models = {
    [GroupModel]: { findById: jest.fn().mockResolvedValue(companies.c1) },
  };
  Groups.findById.mockImplementation((id) => ({
    lean: () => Promise.resolve(companies[String(id)] || null),
  }));
  return MailingSchema.statics.findOneForMosaico
    .call(model, { isAdmin: false }, {})
    .then((result) => result.metadata);
}

describe('findOneForMosaico and the preview links', () => {
  it('gives the editor the address and the limit of the links', async () => {
    const metadata = await metadataFor({
      c1: { _id: 'c1', enableShareLinks: true },
    });
    expect(metadata.url.shareLinks).toBe(
      `/api/mailings/${MAILING_ID}/share-links`
    );
    expect(metadata.shareLinks).toEqual({ maxActive: MAX_ACTIVE_LINKS });
  });

  it('gives them to a company that predates the flag', async () => {
    const metadata = await metadataFor({ c1: { _id: 'c1' } });
    expect(metadata.url.shareLinks).toBeDefined();
  });

  it('gives neither when the company turned the links off', async () => {
    const metadata = await metadataFor({
      c1: { _id: 'c1', enableShareLinks: false },
    });
    expect('shareLinks' in metadata.url).toBe(false);
    expect('shareLinks' in metadata).toBe(false);
  });

  // The server judges a link by the email's company (sharingCompanyOf): the
  // editor must show the section on the same terms, never on the template's
  // company alone.
  it("follows the email's own company over its template's", async () => {
    const companies = {
      c1: { _id: 'c1', enableShareLinks: true },
      c2: { _id: 'c2', enableShareLinks: false },
    };
    const metadata = await metadataFor(companies, {
      _company: { _id: 'c2', name: 'Other' },
    });
    expect('shareLinks' in metadata.url).toBe(false);
  });
});

describe('a company and its preview links', () => {
  const Group = mongoose.model('GroupShareLinksDefault', GroupSchema);

  // On by default: the switch arrives without changing anything for the
  // companies that already share previews.
  it('shares them unless the super admin turned them off', () => {
    expect(new Group({ name: 'Acme' }).enableShareLinks).toBe(true);
    expect(
      new Group({ name: 'Acme', enableShareLinks: false }).enableShareLinks
    ).toBe(false);
  });
});
