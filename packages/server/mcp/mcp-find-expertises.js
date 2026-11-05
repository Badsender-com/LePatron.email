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
// How many scopes in use the description and a refusal name.
const MAX_LISTED_SCOPES = 100;
const SCOPES_KEPT_MS = 60 * 1000;

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
});

const DESCRIPTION =
  'Finds the expertises that apply to a piece of an email: one or more scopes, one or more categories, and optionally an email type and a language. Read each one through its resource URI.';

// The scopes in use, for each audience a company reads: kept a minute, and
// bounded by construction, since there are two audiences to key on (the
// platform company's and every other company's).
const scopesKept = new Map();

/**
 * The scopes an expertise the company may read is written for: those of the
 * active, scoped expertises, normalised. A transversal one applies whatever
 * the scope, so its own scopes match nothing.
 *
 * @param {Object} group the company of the caller
 * @returns {Promise<string[]>}
 */
async function scopesInUse(group) {
  const audience = audienceFilter(group);
  const key = JSON.stringify(audience);
  const kept = scopesKept.get(key);
  if (kept && kept.until > Date.now()) return kept.scopes;
  const scopes = normalizeScopes(
    await Expertises.distinct('scope', {
      status: SkillStatuses.ACTIVE,
      isTransversal: { $ne: true },
      ...audience,
    })
  );
  scopesKept.set(key, { scopes, until: Date.now() + SCOPES_KEPT_MS });
  return scopes;
}

// For the tests, which change the expertises between two runs.
function forgetScopesInUse() {
  scopesKept.clear();
}

function listed(scopes) {
  if (!scopes.length) return 'none yet';
  const named = scopes.slice(0, MAX_LISTED_SCOPES).map((s) => `"${s}"`);
  const more = scopes.length - named.length;
  return `${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

/**
 * The tools as `tools/list` lists them, the scopes this company may ask
 * `find_applicable_expertises` for in its description.
 *
 * @param {{ tools: Object[] }} answer what the SDK lists
 * @param {{ group: Object }} identity
 */
async function withScopesDescribed(answer, { group }) {
  const description = `${DESCRIPTION} The scopes in use: ${listed(
    await scopesInUse(group)
  )}.`;
  return {
    ...answer,
    tools: answer.tools.map((tool) =>
      tool.name === TOOL ? { ...tool, description } : tool
    ),
  };
}

function unknownScopesAnswer(unknown, inUse) {
  const text = `No expertise is written for ${unknown
    .map((s) => `"${s}"`)
    .join(', ')}. The scopes in use: ${listed(
    inUse
  )}. Call again with one or more of them.`;
  return { isError: true, content: [{ type: 'text', text }] };
}

const filled = (value) => (value && value.trim()) || undefined;

async function findExpertises({ group }, args) {
  const scopes = normalizeScopes(args.scope);
  const inUse = await scopesInUse(group);
  const unknown = scopes.filter((scope) => !inUse.includes(scope));
  if (unknown.length) return unknownScopesAnswer(unknown, inUse);

  // The features' own lookup, with the audience of the caller's company. Its
  // diagnostic is for a scope written in a feature's code: an assistant's is
  // answered above.
  const found = await findApplicable({
    scope: scopes,
    categories: args.categories,
    emailType: filled(args.emailType),
    language: filled(args.language),
    groupId: group._id,
    warnOnUnmatched: false,
  });
  const expertises = found.map((expertise) => ({
    expertiseId: expertise.expertiseId,
    title: expertise.title,
    version: versionLabel(expertise),
    uri: uriOf(expertise.expertiseId),
  }));
  return {
    content: [{ type: 'text', text: JSON.stringify({ expertises }) }],
    structuredContent: { expertises },
  };
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

module.exports = {
  registerFindApplicableExpertises,
  withScopesDescribed,
  forgetScopesInUse,
};
