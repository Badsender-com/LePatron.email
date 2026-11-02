'use strict';

// The data set of the search across accessible workspaces (epic #1144,
// ADR 0007), shared by its service tests.
//
// The client group has two workspaces, each with a folder and a subfolder:
// Newsletters (Frank and Wendy are members) and Promotions (Rita is). Another
// client group has one, with a folder and a subfolder too. An email still
// points at a deleted workspace. The stored data is as moves leave it: a
// moved email keeps `null` in the field it left, and one subfolder still
// carries its workspace beside its parent folder.

const config = require('../../../packages/server/node.config.js');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema.js');

/**
 * What `models.common.js` exports, over the fake models: the listing's own
 * pagination static runs over them, since the search shares its filters and
 * sort.
 *
 * @param {Object} store from `createListingStore()`
 */
function modelsOver(store) {
  return {
    Groups: store.Groups,
    Workspaces: store.Workspaces,
    Folders: store.Folders,
    Mailings: {
      ...store.Mailings,
      findForApiWithPagination: MailingSchema.statics.findForApiWithPagination,
    },
    Galleries: {},
    Tags: {},
    Users: {},
    Templates: {},
  };
}

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439c01';

const NEWSLETTERS = '507f1f77bcf86cd799439d01';
const PROMOTIONS = '507f1f77bcf86cd799439d02';
const ELSEWHERE = '507f1f77bcf86cd799439d03';
// A workspace deleted while its emails were not.
const GONE = '507f1f77bcf86cd799439d04';

const YEAR_2026 = '507f1f77bcf86cd799439e01';
const SPRING = '507f1f77bcf86cd799439e02';
const ARCHIVE = '507f1f77bcf86cd799439e03';
const OLD = '507f1f77bcf86cd799439e04';
const MISC = '507f1f77bcf86cd799439e05';
const DEEP = '507f1f77bcf86cd799439e06';

const TEMPLATE_NEWS = '507f1f77bcf86cd799439f01';
const TEMPLATE_PROMO = '507f1f77bcf86cd799439f02';

const FRANK = '507f1f77bcf86cd799430001';
const WENDY = '507f1f77bcf86cd799430002';
const RITA = '507f1f77bcf86cd799430003';

let counter = 0;
function mailing(name, location, fields = {}) {
  counter += 1;
  return {
    _id: `507f1f77bcf86cd7994${String(counter).padStart(5, '0')}`,
    name,
    _wireframe: TEMPLATE_NEWS,
    wireframe: 'news',
    author: 'frank',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...location,
    ...fields,
  };
}

const inClient = (where) => ({ _company: CLIENT_GROUP, ...where });

const MAILINGS = [
  // Moved back to the root of its workspace.
  mailing(
    'Weekly news',
    inClient({ _workspace: NEWSLETTERS, _parentFolder: null }),
    {
      updatedAt: new Date('2026-10-05'),
      tags: ['weekly'],
    }
  ),
  // Moved into a folder.
  mailing(
    'Spring sale',
    inClient({ _workspace: null, _parentFolder: YEAR_2026 }),
    {
      updatedAt: new Date('2026-09-20'),
      tags: ['promo'],
    }
  ),
  mailing('Spring teaser', inClient({ _parentFolder: SPRING }), {
    updatedAt: new Date('2026-09-10'),
  }),
  mailing('Spring promo', inClient({ _workspace: PROMOTIONS }), {
    _wireframe: TEMPLATE_PROMO,
    wireframe: 'promo',
    updatedAt: new Date('2026-08-20'),
    tags: ['promo'],
  }),
  mailing('Spring archive', inClient({ _parentFolder: ARCHIVE }), {
    _wireframe: TEMPLATE_PROMO,
    wireframe: 'promo',
    createdAt: new Date('2025-03-01'),
    updatedAt: new Date('2025-03-01'),
  }),
  mailing('Spring old', inClient({ _parentFolder: OLD })),
  mailing('Spring elsewhere', { _company: OTHER_GROUP, _workspace: ELSEWHERE }),
  mailing('Spring deep elsewhere', {
    _company: OTHER_GROUP,
    _parentFolder: DEEP,
  }),
  mailing('Spring orphan', inClient({ _workspace: GONE })),
];

// What each part of the client group holds, by name.
const IN_NEWSLETTERS = ['Spring sale', 'Spring teaser', 'Weekly news'];
const IN_PROMOTIONS = ['Spring archive', 'Spring old', 'Spring promo'];
const IN_CLIENT_GROUP = [...IN_PROMOTIONS, ...IN_NEWSLETTERS];

function seed(store, { openWorkspaces = false, mailings = MAILINGS } = {}) {
  store.seed({
    groups: [
      { _id: PLATFORM_GROUP, name: 'Platform' },
      {
        _id: CLIENT_GROUP,
        name: 'Client',
        userHasAccessToAllWorkspaces: openWorkspaces,
      },
      { _id: OTHER_GROUP, name: 'Other client' },
    ],
    workspaces: [
      {
        _id: NEWSLETTERS,
        name: 'Newsletters',
        _company: CLIENT_GROUP,
        _users: [FRANK, WENDY],
      },
      {
        _id: PROMOTIONS,
        name: 'Promotions',
        _company: CLIENT_GROUP,
        _users: [RITA],
      },
      { _id: ELSEWHERE, name: 'Elsewhere', _company: OTHER_GROUP },
    ],
    folders: [
      { _id: YEAR_2026, name: '2026', _workspace: NEWSLETTERS },
      // A subfolder that still carries its workspace: its parent folder says
      // where it is.
      {
        _id: SPRING,
        name: 'Spring',
        _workspace: NEWSLETTERS,
        _parentFolder: YEAR_2026,
      },
      { _id: ARCHIVE, name: 'Archive', _workspace: PROMOTIONS },
      { _id: OLD, name: 'Old', _parentFolder: ARCHIVE },
      { _id: MISC, name: 'Misc', _workspace: ELSEWHERE },
      { _id: DEEP, name: 'Deep', _parentFolder: MISC },
    ],
    mailings,
  });
}

const member = (id, role) => ({ id, role, group: { id: CLIENT_GROUP } });

// Members of Newsletters.
const frank = member(FRANK, 'regular_user');
const wendy = member(WENDY, 'writer');
// A member of Promotions.
const rita = member(RITA, 'reviewer');
const companyAdmin = member('507f1f77bcf86cd799430004', 'company_admin');
const techAdmin = member('507f1f77bcf86cd799430005', 'company_admin_tech');
const superAdmin = (selectedGroupId) => ({
  id: '507f1f77bcf86cd799430006',
  role: 'super_admin',
  group: { id: PLATFORM_GROUP },
  selectedGroup: { id: selectedGroupId },
});
const bootstrapAccount = { id: config.admin.id, name: 'admin' };

const BY_NAME = { sortBy: ['name'], sortDesc: [false] };

const names = (result) => result.items.docs.map((doc) => doc.name);
const docNamed = (result, name) =>
  result.items.docs.find((doc) => doc.name === name);

module.exports = {
  CLIENT_GROUP,
  OTHER_GROUP,
  NEWSLETTERS,
  PROMOTIONS,
  YEAR_2026,
  SPRING,
  ARCHIVE,
  OLD,
  TEMPLATE_PROMO,
  IN_NEWSLETTERS,
  IN_PROMOTIONS,
  IN_CLIENT_GROUP,
  modelsOver,
  mailing,
  inClient,
  seed,
  frank,
  wendy,
  rita,
  companyAdmin,
  techAdmin,
  superAdmin,
  bootstrapAccount,
  BY_NAME,
  names,
  docNamed,
};
