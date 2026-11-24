'use strict';

/**
 * The catalog of the tests of `list_changes` (ADR 0031, epic #1661): what was
 * published, opened and withdrawn around the week from 2026-11-16 to
 * 2026-11-22, as the platform company and a client company see it.
 *
 * Expertises:
 * - `crm.governance`: created on the 16th for the platform company, opened to
 *   every company on the 21st;
 * - `deliverability.snds`: created on the 17th, kept to the platform company,
 *   addressing a retex;
 * - `redaction.subject-line`: updated from 1.0 to 1.1 on the 18th, addressing
 *   a retex, with a draft 1.2 nobody published;
 * - `b2b.prospection`: published on the 10th, opened on the 18th;
 * - `design.gmail`: updated on the 19th with the old generic sentence;
 * - `redaction.old-tone`: opened in October, kept to the platform company
 *   again on the 20th;
 * - `redaction.retired`: archived on the 21st;
 * - `deliverability.spam-words`: published in October, unchanged since;
 * - `design.dark-mode`: a draft never published.
 *
 * Skills:
 * - `redaction.subject-ideas`: updated from 1.2 to 1.3 on the 16th;
 * - `deliverability.snds-dashboard`: created on the 17th, kept to the platform
 *   company.
 */

const f = require('./mcp-fixtures');

const at = (iso) => new Date(iso);
const RETEX = '507f1f77bcf86cd799439e01';
const GENERIC_NOTE = 'Correction mineure sans changement de doctrine.';
const GENERIC_LOG = 'Correction mineure';

let count = 0;
const nextId = () =>
  `507f1f77bcf86cd7994398${String((count = (count % 99) + 1)).padStart(
    2,
    '0'
  )}`;

function version(label, status, fields = {}) {
  const [versionMajor, versionMinor] = label.split('.').map(Number);
  return {
    versionMajor,
    versionMinor,
    status,
    body: `## Body\n\nVersion ${label}.`,
    changelog: '',
    releaseNotes: '',
    retexIds: [],
    createdAt: at('2026-09-01T08:00:00Z'),
    updatedAt: fields.activatedAt || at('2026-09-01T08:00:00Z'),
    ...fields,
  };
}

function expertise(expertiseId, title, versions, fields = {}) {
  const active = versions.find((v) => v.status === 'ACTIVE');
  return {
    _id: nextId(),
    expertiseId,
    title,
    description: `About ${title}`,
    category: expertiseId.split('.')[0],
    scope: ['subject'],
    status: active ? 'ACTIVE' : 'DRAFT',
    audience: 'all',
    activeVersion: active
      ? { major: active.versionMajor, minor: active.versionMinor }
      : { major: null, minor: 0 },
    versions,
    audienceHistory: [],
    ...fields,
  };
}

function skill(skillId, title, versions, fields = {}) {
  const active = versions.find((v) => v.status === 'ACTIVE');
  return {
    _id: nextId(),
    skillId,
    title,
    description: `About ${title}`,
    category: skillId.split('.')[0],
    servedToAssistants: true,
    status: 'ACTIVE',
    audience: 'all',
    activeVersion: { major: active.versionMajor, minor: active.versionMinor },
    versions: versions.map(({ body, ...v }) => ({
      nature: 'task',
      procedure: body,
      ...v,
    })),
    audienceHistory: [],
    ...fields,
  };
}

const opened = (iso) => ({ audience: 'all', at: at(iso), _by: f.ALICE });
const closed = (iso) => ({ audience: 'platform', at: at(iso), _by: f.ALICE });

const EXPERTISES = [
  expertise(
    'crm.governance',
    'CRM governance',
    [
      version('1.0', 'ACTIVE', {
        activatedAt: at('2026-11-16T09:00:00Z'),
        releaseNotes: 'Audit a CRM governance.',
        changelog: 'First version',
      }),
    ],
    { audienceHistory: [opened('2026-11-21T10:40:00Z')] }
  ),
  expertise(
    'deliverability.snds',
    'Microsoft SNDS',
    [
      version('1.0', 'ACTIVE', {
        activatedAt: at('2026-11-17T10:00:00Z'),
        releaseNotes: 'Read the SNDS portal.',
        changelog: 'From two retex',
        retexIds: [RETEX],
      }),
    ],
    { audience: 'platform' }
  ),
  expertise('redaction.subject-line', 'Subject lines', [
    version('1.0', 'ARCHIVED', { activatedAt: at('2026-10-01T08:00:00Z') }),
    version('1.1', 'ACTIVE', {
      activatedAt: at('2026-11-18T08:00:00Z'),
      releaseNotes: 'Shorter subjects.',
      changelog: 'Two retex converged',
      retexIds: [RETEX],
    }),
    version('1.2', 'DRAFT', { updatedAt: at('2026-11-19T08:00:00Z') }),
  ]),
  expertise(
    'b2b.prospection',
    'B2B prospection',
    [
      version('1.0', 'ACTIVE', {
        activatedAt: at('2026-11-10T08:00:00Z'),
        releaseNotes: 'Prospect companies by email.',
      }),
    ],
    { audienceHistory: [opened('2026-11-18T12:00:00Z')] }
  ),
  expertise('design.gmail', 'Gmail', [
    version('1.0', 'ARCHIVED', { activatedAt: at('2026-09-10T08:00:00Z') }),
    version('1.1', 'ACTIVE', {
      activatedAt: at('2026-11-19T08:00:00Z'),
      releaseNotes: GENERIC_NOTE,
      changelog: GENERIC_LOG,
    }),
  ]),
  expertise(
    'redaction.old-tone',
    'Old tone',
    [version('1.0', 'ACTIVE', { activatedAt: at('2026-10-01T08:00:00Z') })],
    {
      audience: 'platform',
      audienceHistory: [
        opened('2026-10-02T08:00:00Z'),
        closed('2026-11-20T08:00:00Z'),
      ],
    }
  ),
  expertise(
    'redaction.retired',
    'Retired rules',
    [version('1.0', 'ARCHIVED', { activatedAt: at('2026-09-01T08:00:00Z') })],
    { status: 'ARCHIVED', archivedAt: at('2026-11-21T08:00:00Z') }
  ),
  expertise('deliverability.spam-words', 'Spam words', [
    version('1.0', 'ACTIVE', { activatedAt: at('2026-10-10T08:00:00Z') }),
  ]),
  expertise('design.dark-mode', 'Dark mode', [
    version('1.0', 'DRAFT', { updatedAt: at('2026-11-18T08:00:00Z') }),
  ]),
];

const SKILLS = [
  skill('redaction.subject-ideas', 'Subject line ideas', [
    version('1.2', 'ARCHIVED', { activatedAt: at('2026-10-05T08:00:00Z') }),
    version('1.3', 'ACTIVE', {
      activatedAt: at('2026-11-16T22:47:00Z'),
      releaseNotes: 'Reads the new export.',
      changelog: 'Postmaster export changed',
    }),
  ]),
  skill(
    'deliverability.snds-dashboard',
    'SNDS dashboard',
    [
      version('1.0', 'ACTIVE', {
        activatedAt: at('2026-11-17T11:00:00Z'),
        releaseNotes: 'A dashboard from SNDS.',
        changelog: 'First version',
      }),
    ],
    { audience: 'platform' }
  ),
];

// A user of the platform company who is no super admin.
const PAT = '507f1f77bcf86cd79943910d';

const SEED = {
  ...f.SEED,
  users: [
    ...f.SEED.users,
    {
      _id: PAT,
      name: 'Pat',
      role: 'regular_user',
      _company: f.PLATFORM_GROUP,
      email: 'pat@example.test',
      lang: 'fr',
    },
  ],
  expertises: EXPERTISES,
  skills: SKILLS,
};

module.exports = {
  SEED,
  EXPERTISES,
  SKILLS,
  RETEX,
  PAT,
  GENERIC_NOTE,
  version,
  expertise,
};
