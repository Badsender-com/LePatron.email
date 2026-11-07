'use strict';

const { z } = require('zod');
const {
  findApplicableWithScopesInUse,
} = require('../ai-skill/repositories/expertise.repository.js');
const { normalizeScopes } = require('../ai-skill/services/expertise-scope.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const {
  SkillCategoryValues,
} = require('../ai-skill/constant/skill-constants.js');
const { withIdentity } = require('./mcp-identity.js');
const { withOpenRetex } = require('./mcp-retex-counts.js');
const { uriOf } = require('./mcp-expertises.js');
const { READ_ONLY } = require('./mcp-tool-grammar.js');

const TOOL = 'find_applicable_expertises';

// What an assistant may send: a few short values, never an unbounded `$in`.
const MAX_SCOPES = 10;
const MAX_VALUE_LENGTH = 50;
// How many scopes in use an answer names.
const MAX_LISTED_SCOPES = 100;

const VALUE = z.string().max(MAX_VALUE_LENGTH);
const SCOPE = VALUE.regex(/\S/, 'A scope is not blank');
// A list of scopes, never a string or a list: Copilot Studio reads one type a
// field.
const FIND_INPUT = z.object({
  scope: z
    .array(SCOPE)
    .min(1)
    .max(MAX_SCOPES)
    .describe(
      'The parts of the email worked on, e.g. ["subject"], ["preheader"], ["cta"].'
    ),
  categories: z
    .array(z.enum(SkillCategoryValues))
    .min(1)
    .max(SkillCategoryValues.length)
    .describe(
      `The kinds of know-how wanted, one or more of: ${SkillCategoryValues.join(
        ', '
      )}.`
    ),
  emailType: VALUE.optional().describe(
    'The type of the email, e.g. promo. Without it, the type is not checked.'
  ),
  language: VALUE.optional().describe(
    'The language of the email, as an ISO 639-1 code: fr, en, de… Without it, the language is not checked.'
  ),
});
const FIND_OUTPUT = z.object({
  expertises: z.array(
    z.object({
      expertiseId: z.string(),
      title: z.string(),
      version: z.string(),
      draft: z.boolean().optional(),
      uri: z.string(),
      openRetex: z
        .number()
        .optional()
        .describe(
          'For a super admin: its open retex. Two that converge make a change: read them with list_retex.'
        ),
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

async function findExpertises({ user, group, drafts }, args, ctx) {
  const scopes = normalizeScopes(args.scope);
  // The features' own lookup, with the scopes in use, both within the
  // audience of the caller's company. Its diagnostic is for a scope written
  // in a feature's code: an assistant's is answered in the note below.
  const {
    expertises: found,
    scopesInUse: inUse,
  } = await findApplicableWithScopesInUse({
    scope: scopes,
    categories: args.categories,
    emailType: filled(args.emailType),
    language: filled(args.language),
    groupId: group._id,
    warnOnUnmatched: false,
    // In a super admin's drafts mode, what it is served: the open drafts, the
    // expertises never published included (#1385).
    drafts,
  });
  const unmatchedScopes = scopes.filter((scope) => !inUse.includes(scope));
  const expertises = await withOpenRetex(
    'expertise',
    found.map((expertise) => ({
      expertiseId: expertise.expertiseId,
      title: expertise.title,
      version: versionLabel(expertise),
      ...(expertise.draft && { draft: true }),
      uri: uriOf(expertise.expertiseId),
    })),
    'expertiseId',
    { user, group, authInfo: ctx?.http?.authInfo }
  );
  const answer = {
    expertises,
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
      annotations: READ_ONLY,
    },
    withIdentity(findExpertises)
  );
}

module.exports = { registerFindApplicableExpertises };
