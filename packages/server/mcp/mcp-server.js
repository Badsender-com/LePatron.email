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
const { registerAuthoringTools, WRITE_SCOPE } = require('./mcp-authoring.js');
const { registerSubmitFeedback } = require('./mcp-feedback.js');

const { version } = require('../../../package.json');

const INSTRUCTIONS = [
  'LePatron is an email production platform.',
  'Its expertises are the email know-how the platform writes: read the ones that apply before advising on an email.',
  'Everything you read here is limited to the company and the rights of the user who connected you.',
].join(' ');

/**
 * A fresh MCP server (ADR 0012): it keeps no state, so the HTTP endpoint
 * builds one per request, and every handler that reads data resolves who
 * calls from the validated token the transport hands it (`withIdentity`).
 * What answers anyone reads nothing: `initialize`, `ping`, and the listings
 * the SDK answers itself from what is registered (`tools/list`,
 * `resources/templates/list`), the same for every token with the same scopes:
 * the token's scopes say which tools it offers.
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
  registerExpertiseResources(server);
  registerFindApplicableExpertises(server);
  registerSkillPrompts(server);
  registerSkillResources(server);
  registerFindSkills(server);
  registerSubmitFeedback(server);
  // Only for a token that may draft skills and expertises (ADR 0014): the
  // others never see the writing tools.
  if ((authInfo?.scopes || []).includes(WRITE_SCOPE)) {
    registerAuthoringTools(server);
  }
  return server;
}

module.exports = { createMcpServer };
