'use strict';

const { McpServer } = require('@modelcontextprotocol/server');
const {
  registerExpertiseResources,
  registerFindApplicableExpertises,
} = require('./mcp-expertises.js');
const { registerSkillPrompts } = require('./mcp-skills.js');
const {
  registerSkillResources,
  registerFindSkills,
} = require('./mcp-skill-resources.js');
const { registerAuthoringTools } = require('./mcp-authoring.js');
const { WRITE_SCOPE } = require('./mcp-identity.js');
const { registerUseDrafts } = require('./mcp-drafts.js');
const { registerSubmitFeedback } = require('./mcp-feedback.js');
const {
  registerListMailings,
  registerListWorkspaces,
} = require('./mcp-mailings.js');
const { guardCalls } = require('./mcp-call-guard.js');

const { version } = require('../../../package.json');

const INSTRUCTIONS = [
  'LePatron is an email production platform.',
  'Its expertises are the email know-how of Badsender: read them before advising on an email.',
  'Everything you read here is limited to the group and the rights of the user who connected you.',
  // Badsender writes in French, and keeps doing so: the assistant bridges.
  'The skills and expertises are written in French, whatever language the user speaks.',
  "Apply them as they are, and always answer in the user's language, translating what you quote from them.",
  'To find a skill, search with French words, or list them all with find_skills and pick by their descriptions.',
  "The language of the email you work on may differ from the user's: an expertise may apply to emails in some languages only, so give find_applicable_expertises the language of the email.",
].join(' ');

/**
 * A fresh MCP server (ADR 0012): it keeps no state, so the HTTP endpoint
 * builds one per request, and each handler resolves who calls from the
 * validated token the transport hands it. The token's scopes say which tools
 * it offers. What it is asked is rate limited and logged (mcp-call-guard.js).
 *
 * @param {Object} [options]
 * @param {Object} [options.authInfo] the validated access token
 * @returns {McpServer}
 */
function createMcpServer({ authInfo } = {}) {
  const server = new McpServer(
    { name: 'lepatron', title: 'LePatron', version },
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
  registerListMailings(server);
  registerListWorkspaces(server);
  // Only for a token that may draft skills and expertises (ADR 0014): the
  // others never see the writing tools.
  if ((authInfo?.scopes || []).includes(WRITE_SCOPE)) {
    registerAuthoringTools(server);
    // Trying the drafts before publishing them (#1385).
    registerUseDrafts(server);
  }
  return server;
}

module.exports = { createMcpServer };
