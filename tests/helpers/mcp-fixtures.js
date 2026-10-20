'use strict';

/**
 * Shared fixtures of the MCP acceptance tests (epic #1290, ADR 0008).
 *
 * A client group with every role of ADR 0004, two of its workspaces (one the
 * regular user, the writer and the reviewer are members of, one they are not),
 * a group without MCP access, another subscribed group, the platform group and
 * its super admin, the expertises and skills of the platform, and the mailings
 * whose facts give each mailing status.
 *
 * Plain records, stored as the schemas declare them: the MCP harness seeds them
 * in its stand-ins for the models (`tests/helpers/mcp-harness.js`).
 */

// Dates are relative to the run, so a mailing's status does not drift with the
// calendar: "planned in 5 days" stays in the future.
const NOW = new Date();
const daysFrom = (days) => new Date(NOW.getTime() + days * 24 * 3600 * 1000);

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439c01';
const UNSUBSCRIBED_GROUP = '507f1f77bcf86cd799439d01';

const GROUPS = [
  { _id: PLATFORM_GROUP, name: 'Platform', isPlatform: true, enableMcp: true },
  {
    _id: CLIENT_GROUP,
    name: 'A client',
    enableMcp: true,
    allowRetex: false,
    userHasAccessToAllWorkspaces: false,
    logRetentionDays: 30,
  },
  { _id: OTHER_GROUP, name: 'Another client', enableMcp: true },
  { _id: UNSUBSCRIBED_GROUP, name: 'Not subscribed', enableMcp: false },
];

const ALICE = '507f1f77bcf86cd799439101'; // super admin, platform group
const ERIN = '507f1f77bcf86cd799439105'; // company admin, client group
const TESS = '507f1f77bcf86cd799439107'; // tech admin, client group
const FRANK = '507f1f77bcf86cd799439106'; // regular user, client group
const WREN = '507f1f77bcf86cd799439108'; // writer, client group
const REX = '507f1f77bcf86cd799439109'; // reviewer, client group
const DEAN = '507f1f77bcf86cd79943910a'; // deactivated regular user, client group
const OTTO = '507f1f77bcf86cd79943910b'; // regular user, other group
const NINA = '507f1f77bcf86cd79943910c'; // regular user, unsubscribed group

function user(_id, name, role, _company, extra = {}) {
  return {
    _id,
    name,
    role,
    _company,
    email: `${name.toLowerCase()}@example.test`,
    lang: 'fr',
    ...extra,
  };
}

const USERS = [
  user(ALICE, 'Alice', 'super_admin', PLATFORM_GROUP),
  user(ERIN, 'Erin', 'company_admin', CLIENT_GROUP),
  user(TESS, 'Tess', 'company_admin_tech', CLIENT_GROUP),
  user(FRANK, 'Frank', 'regular_user', CLIENT_GROUP),
  user(WREN, 'Wren', 'writer', CLIENT_GROUP),
  user(REX, 'Rex', 'reviewer', CLIENT_GROUP),
  user(DEAN, 'Dean', 'regular_user', CLIENT_GROUP, { isDeactivated: true }),
  user(OTTO, 'Otto', 'regular_user', OTHER_GROUP),
  user(NINA, 'Nina', 'regular_user', UNSUBSCRIBED_GROUP),
];

const WS_NEWS = '507f1f77bcf86cd799439201'; // Frank, Wren, Rex and Dean are members
const WS_PROMO = '507f1f77bcf86cd799439202'; // nobody but the admins reads it
const WS_OTHER = '507f1f77bcf86cd799439203';
const FOLDER_ARCHIVE = '507f1f77bcf86cd799439301'; // inside WS_NEWS

const WORKSPACES = [
  {
    _id: WS_NEWS,
    name: 'Newsletters',
    _company: CLIENT_GROUP,
    _users: [FRANK, WREN, REX, DEAN],
  },
  { _id: WS_PROMO, name: 'Promotions', _company: CLIENT_GROUP, _users: [] },
  { _id: WS_OTHER, name: 'Theirs', _company: OTHER_GROUP, _users: [OTTO] },
];

const FOLDERS = [{ _id: FOLDER_ARCHIVE, name: 'Archive', _workspace: WS_NEWS }];

const NEWSLETTER_HTML = `<!DOCTYPE html><html><head>
<style>.title { color: #c00; }</style></head><body>
<table role="presentation"><tr><td>
<h1 class="title">Black Friday is coming</h1>
<p>Hello {{firstname}}, our best prices of the year start on Friday.</p>
<p>Free delivery on every order.</p>
<a href="https://shop.example.test/black-friday" style="background:#c00">See the offers</a>
</td></tr></table></body></html>`;

const M_NEWSLETTER = '507f1f77bcf86cd799439401'; // approved, then pushed to ESP
const M_SCHEDULED = '507f1f77bcf86cd799439402'; // approved, planned in 5 days
const M_APPROVED = '507f1f77bcf86cd799439403'; // approved, no planned date
const M_DRAFT_PAST = '507f1f77bcf86cd799439404'; // planned date passed, never pushed
const M_ARCHIVED = '507f1f77bcf86cd799439405'; // in a folder of WS_NEWS
const M_NO_PREVIEW = '507f1f77bcf86cd799439406'; // never saved in the editor
const M_PROMO = '507f1f77bcf86cd799439407'; // in WS_PROMO
const M_OTHER = '507f1f77bcf86cd799439408'; // in another group

function mailing(_id, name, location, extra = {}) {
  return {
    _id,
    name,
    _company: CLIENT_GROUP,
    _wireframe: '507f1f77bcf86cd799439501',
    wireframe: 'Brand template',
    tags: [],
    espIds: [],
    previewHtml: NEWSLETTER_HTML,
    createdAt: daysFrom(-30),
    updatedAt: daysFrom(-2),
    ...location,
    ...extra,
  };
}

const MAILINGS = [
  mailing(
    M_NEWSLETTER,
    'Black Friday 2025',
    { _workspace: WS_NEWS },
    {
      subject: 'Black Friday: our best prices',
      tags: ['black-friday'],
      plannedSendDate: daysFrom(-330),
      espIds: [{ profileId: '507f1f77bcf86cd799439601', campaignId: 'c-42' }],
    }
  ),
  mailing(
    M_SCHEDULED,
    'November newsletter',
    { _workspace: WS_NEWS },
    {
      subject: 'What is new in November',
      plannedSendDate: daysFrom(5),
    }
  ),
  mailing(M_APPROVED, 'Welcome series #1', { _workspace: WS_NEWS }),
  mailing(
    M_DRAFT_PAST,
    'October newsletter',
    { _workspace: WS_NEWS },
    {
      plannedSendDate: daysFrom(-10),
    }
  ),
  mailing(
    M_ARCHIVED,
    'Black Friday 2024',
    { _parentFolder: FOLDER_ARCHIVE },
    {
      tags: ['black-friday'],
    }
  ),
  mailing(
    M_NO_PREVIEW,
    'Blank draft',
    { _workspace: WS_NEWS },
    {
      previewHtml: undefined,
    }
  ),
  mailing(M_PROMO, 'Spring sale', { _workspace: WS_PROMO }),
  mailing(
    M_OTHER,
    'Their newsletter',
    { _workspace: WS_OTHER },
    {
      _company: OTHER_GROUP,
    }
  ),
];

// The last top-level comment decides whether a mailing is approved.
const COMMENTS = [M_NEWSLETTER, M_SCHEDULED, M_APPROVED].map((_mailing, i) => ({
  _id: `507f1f77bcf86cd79943970${i}`,
  _mailing,
  _company: CLIENT_GROUP,
  author: REX,
  text: 'Good to go',
  decision: 'approved',
  createdAt: daysFrom(-3),
}));

const { EXPERTISES, SKILLS } = require('./mcp-ai-fixtures');

// Everything the MCP harness seeds, keyed by the collection it stands for.
const SEED = {
  groups: GROUPS,
  users: USERS,
  workspaces: WORKSPACES,
  folders: FOLDERS,
  mailings: MAILINGS,
  comments: COMMENTS,
  expertises: EXPERTISES,
  skills: SKILLS,
};

module.exports = {
  SEED,
  NOW,
  daysFrom,
  PLATFORM_GROUP,
  CLIENT_GROUP,
  OTHER_GROUP,
  UNSUBSCRIBED_GROUP,
  GROUPS,
  ALICE,
  ERIN,
  TESS,
  FRANK,
  WREN,
  REX,
  DEAN,
  OTTO,
  NINA,
  USERS,
  WS_NEWS,
  WS_PROMO,
  WS_OTHER,
  FOLDER_ARCHIVE,
  WORKSPACES,
  FOLDERS,
  M_NEWSLETTER,
  M_SCHEDULED,
  M_APPROVED,
  M_DRAFT_PAST,
  M_ARCHIVED,
  M_NO_PREVIEW,
  M_PROMO,
  M_OTHER,
  MAILINGS,
  COMMENTS,
  EXPERTISES,
  SKILLS,
};
