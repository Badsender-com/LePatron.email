'use strict';

const { McpServer } = require('@modelcontextprotocol/server');
const { registerExpertiseResources } = require('./mcp-expertises.js');
const {
  registerFindApplicableExpertises,
} = require('./mcp-find-expertises.js');
const { registerSkillPrompts } = require('./mcp-skills.js');
const {
  registerSkillResources,
  registerFindSkills,
} = require('./mcp-skill-resources.js');
const { registerAuthoringTools } = require('./mcp-authoring.js');
const { registerPublicationTools } = require('./mcp-publication.js');
const { registerUseDrafts } = require('./mcp-drafts.js');
const { registerSubmitFeedback } = require('./mcp-feedback.js');
const { registerReportRetex } = require('./mcp-retex.js');
const { registerRetexReading } = require('./mcp-retex-read.js');
const {
  registerListMailings,
  registerListWorkspaces,
} = require('./mcp-mailings.js');
const {
  registerGetMailing,
  registerMailingResources,
} = require('./mcp-mailing-read.js');
const { registerPreviewApp } = require('./mcp-preview-app.js');
const { registerSearchAndFetch } = require('./mcp-search.js');
const { guardCalls } = require('./mcp-call-guard.js');
const { hasScope, WRITE_SCOPE } = require('./mcp-identity.js');
const { siteOrigin } = require('../utils/site-origin.js');

const { version } = require('../../../package.json');

const INSTRUCTIONS = [
  'LePatron is an email production platform.',
  'Its expertises are the email know-how the platform writes: read the ones that apply before advising on an email.',
  'Everything you read here is limited to the company and the rights of the user who connected you.',
  // The platform company writes in French, and keeps doing so: the
  // assistant bridges.
  'The skills and expertises are written in French, whatever language the user speaks.',
  "Apply them as they are, and always answer in the user's language, translating what you quote from them.",
  'To find a skill, search with French words, or list them all with find_skills and pick by their descriptions.',
  "The language of the email you work on may differ from the user's: an expertise may apply to emails in some languages only, so give find_applicable_expertises the language of the email.",
].join(' ');

/**
 * A fresh MCP server (ADR 0012): it keeps no state, so the HTTP endpoint
 * builds one per request, and every handler that reads data resolves who
 * calls from the validated token the transport hands it (`withIdentity`).
 * What answers anyone reads nothing: `initialize`, `ping`, and the listings
 * the SDK answers itself from what is registered (`tools/list`,
 * `resources/templates/list`), the same for every token with the same scopes:
 * the token's scopes say which tools it offers. What it is asked is rate
 * limited and logged (mcp-call-guard.js).
 *
 * @param {Object} [options]
 * @param {Object} [options.authInfo] the validated access token
 * @returns {McpServer}
 */
function createMcpServer({ authInfo } = {}) {
  const server = new McpServer(
    {
      name: 'lepatron',
      title: 'LePatron',
      version,
      description:
        'The email production platform: its expertises, its skills and your mailings.',
      websiteUrl: siteOrigin(),
      icons: [
        {
          src: `${siteOrigin()}/pique_aiguille.svg`,
          mimeType: 'image/svg+xml',
        },
      ],
    },
    { instructions: INSTRUCTIONS }
  );
  // Before anything is registered: every handler is rate limited and logged.
  guardCalls(server);
  registerExpertiseResources(server);
  registerFindApplicableExpertises(server);
  registerSkillPrompts(server);
  registerSkillResources(server);
  registerFindSkills(server);
  registerSubmitFeedback(server);
  // What the work taught (ADR 0021): anyone reports a retex.
  registerReportRetex(server);
  registerListMailings(server);
  registerListWorkspaces(server);
  registerGetMailing(server);
  registerMailingResources(server);
  registerPreviewApp(server);
  registerSearchAndFetch(server);
  // Only for a token that may draft skills and expertises (ADR 0014): the
  // others never see the writing tools.
  if (hasScope(authInfo, WRITE_SCOPE)) {
    registerAuthoringTools(server);
    // Publishing a draft, in two calls (ADR 0019).
    registerPublicationTools(server);
    // Trying the drafts before publishing them (#1385).
    registerUseDrafts(server);
    // The retex of every company, to improve the skills and expertises.
    registerRetexReading(server);
  }
  return server;
}

module.exports = { createMcpServer };
