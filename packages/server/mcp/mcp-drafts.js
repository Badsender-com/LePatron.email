'use strict';

const { z } = require('zod');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { withIdentity, failure, success } = require('./mcp-identity.js');
const { setDraftsMode } = require('./mcp-connections.js');

// How long the drafts mode stays on: an afternoon of tries, not a habit.
const DRAFTS_TTL = 4 * 3600 * 1000;

// Which version of a skill or an expertise is served in drafts mode is
// decided where what is published is (`findServed`,
// ai-skill/repositories/published.repository.js); this module turns the mode
// on and off, and says what is served from a draft.

/**
 * What a content served from a draft says of itself, so a try is never taken
 * for the published word; nothing for a published one.
 *
 * @param {{ version: Object, draft: boolean }} found
 * @returns {string}
 */
function draftNotice({ version, draft }) {
  return draft
    ? `**Draft ${versionLabel(
        version
      )}, not published.** Served because the drafts mode is on: the users of LePatron do not read it.`
    : '';
}

const USE_DRAFTS_INPUT = z.object({ on: z.boolean() });
const USE_DRAFTS_OUTPUT = z.object({
  drafts: z.boolean(),
  until: z.string().nullable(),
});

/**
 * The tool that turns the drafts mode on or off, for the connection of the
 * token: registered for a token that may draft (ADR 0014) only.
 *
 * @param {import('@modelcontextprotocol/server').McpServer} server
 */
function registerUseDrafts(server) {
  // What the client lists changes with the mode: it is told so, and reloads.
  server.server.registerCapabilities({
    prompts: { listChanged: true },
    resources: { listChanged: true },
  });
  server.registerTool(
    'use_drafts',
    {
      title: 'Try the drafts of skills and expertises',
      description:
        'Turns the drafts mode on or off for this connection. While on, every skill and expertise is served at its latest unpublished draft when it has one, the expertises a skill consumes included, so a draft can be tried before it is published. Each content served from a draft says so. The mode turns itself off after a few hours, and at each new connection. The prompts and resources listed change with the mode: reload them when told so.',
      inputSchema: USE_DRAFTS_INPUT,
      outputSchema: USE_DRAFTS_OUTPUT,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    withIdentity(async (_identity, { on }, ctx) => {
      const authInfo = ctx.http?.authInfo;
      const until = on ? new Date(Date.now() + DRAFTS_TTL) : null;
      if (!(await setDraftsMode(authInfo?.extra?.grantId, until))) {
        return failure(
          'This connection cannot keep the drafts mode: connect through LePatron’s authorization server.'
        );
      }
      // In the answer's own stream, so it reaches a client that keeps none
      // open between requests.
      await ctx.mcpReq.notify({ method: 'notifications/prompts/list_changed' });
      await ctx.mcpReq.notify({
        method: 'notifications/resources/list_changed',
      });
      return success({ drafts: on, until: until && until.toISOString() });
    })
  );
}

module.exports = {
  draftNotice,
  registerUseDrafts,
  DRAFTS_TTL,
};
