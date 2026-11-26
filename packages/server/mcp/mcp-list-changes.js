'use strict';

/**
 * `list_changes` (ADR 0031): what changed in the catalog of skills and
 * expertises in a period, as the connected company sees it. Every connection
 * is offered it; what each change says depends on who reads it
 * (`mcp-catalog-changes.js`). Only what was published: a draft is no change,
 * in the drafts mode as anywhere.
 */

const { z } = require('zod');
const { LePatronSkills, Expertises } = require('../common/models.common.js');
const {
  SkillStatuses,
  AudienceValues,
} = require('../ai-skill/constant/skill-constants.js');
const { readsEveryAudience } = require('../ai-skill/services/audience.js');
const {
  withIdentity,
  success,
  failure,
  isConsultant,
} = require('./mcp-identity.js');
const { changesOf, publications } = require('./mcp-catalog-changes.js');
const { uriOf: skillUriOf } = require('./mcp-skill-catalog.js');
const { uriOf: expertiseUriOf } = require('./mcp-expertises.js');
const { READ_ONLY } = require('./mcp-tool-grammar.js');

const DAY_MS = 24 * 3600 * 1000;
const DEFAULT_DAYS = 7;
const MAX_CHANGES = 200;
const MAX_DATE_LENGTH = 40;
const CHANGES = ['created', 'updated', 'opened', 'withdrawn'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// What is read of each item: never a body, nor a skill's test cases.
const READ = {
  title: 1,
  category: 1,
  status: 1,
  audience: 1,
  audienceHistory: 1,
  archivedAt: 1,
  servedToAssistants: 1,
  activeVersion: 1,
  'versions.versionMajor': 1,
  'versions.versionMinor': 1,
  'versions.status': 1,
  'versions.activatedAt': 1,
  'versions.releaseNotes': 1,
  'versions.changelog': 1,
  'versions.retexIds': 1,
  'versions.nature': 1,
};

const DATE = z.string().max(MAX_DATE_LENGTH).optional();
const INPUT = z.object({
  since: DATE.describe(
    `The start of the period, as an ISO 8601 date or date-time, in UTC unless it says otherwise. A day alone starts at midnight UTC. Default: ${DEFAULT_DAYS} days before until.`
  ),
  until: DATE.describe(
    'The end of the period, as an ISO 8601 date or date-time. A day alone is included whole, to midnight UTC. Default: now.'
  ),
  kind: z
    .enum(['skill', 'expertise'])
    .optional()
    .describe('Only the skills, or only the expertises. Default: both.'),
  change: z
    .array(z.enum(CHANGES))
    .max(CHANGES.length)
    .optional()
    .describe(
      'Only these changes: created, updated (a new version), opened (to every company, told to the platform company only: another company sees an opening as created), withdrawn (from them). Default: all.'
    ),
  audience: z
    .enum(AudienceValues)
    .optional()
    .describe(
      'For the platform company: only the items at this audience now, platform or all. Ignored for another company, which sees only what is open to it.'
    ),
});
const CHANGE = z.object({
  kind: z.enum(['skill', 'expertise']),
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  change: z.enum(CHANGES),
  at: z.string().describe('When it happened, in UTC.'),
  fromVersion: z.string().nullable().optional(),
  toVersion: z.string().nullable().optional(),
  releaseNotes: z
    .string()
    .nullable()
    .optional()
    .describe(
      'The release note of the version: what changes for whoever uses it; null when none was written.'
    ),
  changelog: z
    .string()
    .nullable()
    .optional()
    .describe(
      'For the platform company and a super admin: the change log, how and why the version was written.'
    ),
  addressesRetex: z
    .array(z.string())
    .optional()
    .describe('For a super admin: the retex this version addressed.'),
  audience: z.enum(AudienceValues).optional(),
  uri: z.string().optional().describe('Its resource, when it may be read.'),
});
const OUTPUT = z.object({
  since: z.string(),
  until: z.string(),
  changes: z.array(CHANGE),
  truncated: z
    .boolean()
    .describe(
      `true when more than ${MAX_CHANGES} changes were found: narrow the period.`
    ),
});

// A date as given, or the reason it cannot be read.
function dateOf(text, { endOfDay }) {
  if (DAY.test(text)) {
    const start = Date.parse(`${text}T00:00:00.000Z`);
    return endOfDay ? start + DAY_MS - 1 : start;
  }
  const at = Date.parse(text);
  return Number.isNaN(at) ? null : at;
}

function periodOf({ since, until }) {
  const end = until ? dateOf(until, { endOfDay: true }) : Date.now();
  const start = since
    ? dateOf(since, { endOfDay: false })
    : end - DEFAULT_DAYS * DAY_MS;
  if (start === null || end === null) {
    return {
      refused: `"${
        start === null ? since : until
      }" is not a date: give an ISO 8601 date, such as 2026-11-16, or a date-time.`,
    };
  }
  if (start > end) {
    return {
      refused:
        'The period ends before it starts: since must come before until.',
    };
  }
  return { since: start, until: end };
}

// Whether a reader may read the item now, through its resource.
function readable(kind, doc, everyAudience) {
  if (doc.status !== SkillStatuses.ACTIVE) return false;
  if (!everyAudience && doc.audience !== 'all') return false;
  if (kind === 'expertise') return true;
  const [active] = publications(doc).slice(-1);
  return (
    (active && active.nature === 'task') || doc.servedToAssistants === true
  );
}

const SOURCES = [
  {
    kind: 'skill',
    Model: LePatronSkills,
    idField: 'skillId',
    uriOf: skillUriOf,
  },
  {
    kind: 'expertise',
    Model: Expertises,
    idField: 'expertiseId',
    uriOf: expertiseUriOf,
  },
];

async function itemsOf(source) {
  return source.Model.find(
    { status: { $in: [SkillStatuses.ACTIVE, SkillStatuses.ARCHIVED] } },
    { ...READ, [source.idField]: 1 }
  ).lean();
}

const order = (a, b) =>
  a.at.localeCompare(b.at) ||
  a.kind.localeCompare(b.kind) ||
  a.id.localeCompare(b.id);

async function listChanges({ user, group }, args) {
  const period = periodOf(args);
  if (period.refused) return failure(period.refused);
  const everyAudience = readsEveryAudience(group);
  const consultant = isConsultant(user);
  // The catalog is the connected company's; the change log and the retex
  // follow the person, as a super admin reads them through any connection.
  const reader = {
    everyAudience,
    changelog: everyAudience || consultant,
    consultant,
  };
  const sources = SOURCES.filter((s) => !args.kind || s.kind === args.kind);
  const found = await Promise.all(sources.map(itemsOf));
  const changes = sources
    .flatMap((source, index) =>
      found[index]
        .filter(
          (doc) =>
            !reader.everyAudience ||
            !args.audience ||
            doc.audience === args.audience
        )
        .flatMap((doc) => {
          const id = doc[source.idField];
          const item = {
            ...doc,
            id,
            ...(readable(source.kind, doc, reader.everyAudience) && {
              uri: source.uriOf(id),
            }),
          };
          return changesOf(source.kind, item, reader, period);
        })
    )
    .filter((c) => !args.change || args.change.includes(c.change))
    .sort(order);
  return success({
    since: new Date(period.since).toISOString(),
    until: new Date(period.until).toISOString(),
    changes: changes.slice(0, MAX_CHANGES),
    truncated: changes.length > MAX_CHANGES,
  });
}

function registerListChanges(server) {
  server.registerTool(
    'list_changes',
    {
      title: 'List the catalog changes',
      description: `Lists what changed in the skills and expertises this company may use, in a period: created, updated by a new version, opened to every company (to the platform company; any other company sees what is opened to it as created), withdrawn from them, the oldest first, ${MAX_CHANGES} at most. Each change, an opening included, gives the release note of its version (releaseNotes), what changes for whoever uses it, written in French. Use it to answer "what is new?": never guess a date or a reason. Only what was published is listed, never a draft.`,
      inputSchema: INPUT,
      outputSchema: OUTPUT,
      annotations: READ_ONLY,
    },
    withIdentity(listChanges)
  );
}

module.exports = { registerListChanges };
