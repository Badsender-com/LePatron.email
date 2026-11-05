'use strict';

const { z } = require('zod');
const { Expertises } = require('../common/models.common.js');
const {
  findApplicable,
} = require('../ai-skill/repositories/expertise.repository.js');
const { normalizeScopes } = require('../ai-skill/services/expertise-scope.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const {
  SkillStatuses,
  SkillCategoryValues,
} = require('../ai-skill/constant/skill-constants.js');
const { audienceFilter } = require('../ai-skill/services/audience.js');
const { withIdentity } = require('./mcp-identity.js');
const { uriOf } = require('./mcp-expertises.js');

const TOOL = 'find_applicable_expertises';

// What an assistant may send: a few short values, never an unbounded `$in`.
const MAX_SCOPES = 10;
const MAX_VALUE_LENGTH = 50;
// How many scopes in use an answer names.
const MAX_LISTED_SCOPES = 100;

const VALUE = z.string().max(MAX_VALUE_LENGTH);
const SCOPE = VALUE.regex(/\S/, 'A scope is not blank');
const FIND_INPUT = z.object({
  scope: z.union([SCOPE, z.array(SCOPE).min(1).max(MAX_SCOPES)]),
  categories: z
    .array(z.enum(SkillCategoryValues))
    .min(1)
    .max(SkillCategoryValues.length),
  emailType: VALUE.optional(),
  language: VALUE.optional(),
});
const FIND_OUTPUT = z.object({
  expertises: z.array(
    z.object({
      expertiseId: z.string(),
      title: z.string(),
      version: z.string(),
      uri: z.string(),
    })
  ),
  scopesInUse: z.array(z.string()),
  unmatchedScopes: z.array(z.string()),
});

// Fixed: `tools/list` is the same for every caller, and reads nothing.
const DESCRIPTION = [
  'Finds the expertises that apply to a piece of an email: one or more scopes, one or more categories, and optionally an email type and a language.',
  'A transversal expertise applies whatever the scope.',
  'The answer also gives the scopes in use, and the scopes you asked for that no expertise is written for: call again with scopes in use to find more.',
  'Read each expertise through its resource URI.',
].join(' ');

/**
 * The scopes an expertise the company may read is written for: those of the
 * active, scoped expertises, normalised. A transversal one applies whatever
 * the scope, so its own scopes match nothing.
 *
 * @param {Object} group the company of the caller, with `isPlatform`
 * @returns {Promise<string[]>}
 */
async function scopesInUse(group) {
  return normalizeScopes(
    await Expertises.distinct('scope', {
      status: SkillStatuses.ACTIVE,
      isTransversal: { $ne: true },
      ...audienceFilter(group),
    })
  );
}

const quoted = (scopes) => scopes.map((scope) => `"${scope}"`).join(', ');

function listed(scopes) {
  if (!scopes.length) return 'none yet';
  const more = scopes.length - MAX_LISTED_SCOPES;
  return `${quoted(scopes.slice(0, MAX_LISTED_SCOPES))}${
    more > 0 ? ` and ${more} more` : ''
  }`;
}

// Not an error: what was found stands, the note says how to find more.
function noteOn(unmatched, inUse) {
  return `No expertise is written for ${quoted(
    unmatched
  )}. The scopes in use: ${listed(inUse)}.`;
}

const filled = (value) => (value && value.trim()) || undefined;

async function findExpertises({ group }, args) {
  const scopes = normalizeScopes(args.scope);
  // The features' own lookup, with the audience of the caller's company. Its
  // diagnostic is for a scope written in a feature's code: an assistant's is
  // answered in the note below.
  const [found, inUse] = await Promise.all([
    findApplicable({
      scope: scopes,
      categories: args.categories,
      emailType: filled(args.emailType),
      language: filled(args.language),
      groupId: group._id,
      warnOnUnmatched: false,
    }),
    scopesInUse(group),
  ]);
  const unmatchedScopes = scopes.filter((scope) => !inUse.includes(scope));
  const answer = {
    expertises: found.map((expertise) => ({
      expertiseId: expertise.expertiseId,
      title: expertise.title,
      version: versionLabel(expertise),
      uri: uriOf(expertise.expertiseId),
    })),
    scopesInUse: inUse.slice(0, MAX_LISTED_SCOPES),
    unmatchedScopes,
  };
  const content = [{ type: 'text', text: JSON.stringify(answer) }];
  if (unmatchedScopes.length) {
    content.push({ type: 'text', text: noteOn(unmatchedScopes, inUse) });
  }
  return { content, structuredContent: answer };
}

function registerFindApplicableExpertises(server) {
  server.registerTool(
    TOOL,
    {
      title: 'Find the expertises that apply',
      description: DESCRIPTION,
      inputSchema: FIND_INPUT,
      outputSchema: FIND_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(findExpertises)
  );
}

module.exports = { registerFindApplicableExpertises };
