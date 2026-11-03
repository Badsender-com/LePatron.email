'use strict';

const { z } = require('zod');
const { SkillStatuses } = require('../ai-skill/constant/skill-constants.js');
const {
  findActiveVersion,
} = require('../ai-skill/services/version-helpers.js');
const { resolveIdentity } = require('./mcp-identity.js');
const { setDraftsMode } = require('./mcp-connections.js');

// How long the drafts mode stays on: an afternoon of tries, not a habit.
const DRAFTS_TTL = 4 * 3600 * 1000;

const versionOf = (version) =>
  `${version.versionMajor}.${version.versionMinor}`;

// The latest draft of a skill or an expertise, by its version number.
function latestDraft(doc) {
  return (doc.versions || [])
    .filter((version) => version.status === SkillStatuses.DRAFT)
    .reduce(
      (latest, version) =>
        !latest ||
        version.versionMajor > latest.versionMajor ||
        (version.versionMajor === latest.versionMajor &&
          version.versionMinor > latest.versionMinor)
          ? version
          : latest,
      null
    );
}

/**
 * The statuses of the skills and expertises served: the active ones, and in
 * drafts mode the ones never published too. Archived ones never are.
 *
 * @param {boolean} drafts
 */
function servedStatuses(drafts) {
  return drafts
    ? { $in: [SkillStatuses.ACTIVE, SkillStatuses.DRAFT] }
    : SkillStatuses.ACTIVE;
}

/**
 * The version of a skill or an expertise served (ADR 0012, 0014): its active
 * version, or in drafts mode its latest draft when it has one. `draft` says
 * which, for what is served to say it too.
 *
 * @param {Object} doc a skill or an expertise
 * @param {boolean} drafts
 * @returns {{ doc: Object, version: Object, draft: boolean }|null}
 */
function servedVersion(doc, drafts) {
  if (!doc || doc.status === SkillStatuses.ARCHIVED) return null;
  const draft = drafts && latestDraft(doc);
  if (draft) return { doc, version: draft, draft: true };
  if (doc.status !== SkillStatuses.ACTIVE) return null;
  const version = findActiveVersion(doc);
  if (!version || version.status !== SkillStatuses.ACTIVE) return null;
  return { doc, version, draft: false };
}

/**
 * What a content served from a draft says of itself, so a try is never taken
 * for the published word; nothing for a published one.
 *
 * @param {{ version: Object, draft: boolean }} found
 * @returns {string}
 */
function draftNotice({ version, draft }) {
  return draft
    ? `**Draft ${versionOf(
        version
      )}, not published.** Served because the drafts mode is on: the users of LePatron do not read it.`
    : '';
}

const failure = (text) => ({
  isError: true,
  content: [{ type: 'text', text }],
});

/**
 * The tool that turns the drafts mode on or off, for the connection of the
 * token: registered for a token that may draft (ADR 0014) only.
 *
 * @param {import('@modelcontextprotocol/server').McpServer} server
 */
function registerUseDrafts(server) {
  server.registerTool(
    'use_drafts',
    {
      title: 'Try the drafts of skills and expertises',
      description:
        'Turns the drafts mode on or off for this connection. While on, every Badsender skill and expertise is served at its latest unpublished draft when it has one, the expertises a skill consumes included, so a draft can be tried before it is published. Each content served from a draft says so. The mode turns itself off after a few hours, and at each new connection. A skill never published shows among the prompts only after reconnecting; find it with find_skills meanwhile.',
      inputSchema: z.object({ on: z.boolean() }),
      outputSchema: z.object({
        drafts: z.boolean(),
        until: z.string().nullable(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ on }, ctx) => {
      const authInfo = ctx.http?.authInfo;
      await resolveIdentity(authInfo);
      const until = on ? new Date(Date.now() + DRAFTS_TTL) : null;
      if (!(await setDraftsMode(authInfo?.extra?.grantId, until))) {
        return failure(
          'This connection cannot keep the drafts mode: connect through LePatron’s authorization server.'
        );
      }
      const answer = { drafts: on, until: until && until.toISOString() };
      return {
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        structuredContent: answer,
      };
    }
  );
}

module.exports = {
  servedStatuses,
  servedVersion,
  draftNotice,
  registerUseDrafts,
  DRAFTS_TTL,
};
