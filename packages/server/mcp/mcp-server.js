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
const { registerAuthoringTools, WRITE_SCOPE } = require('./mcp-authoring.js');
const { registerSubmitFeedback } = require('./mcp-feedback.js');
const { guardCalls } = require('./mcp-call-guard.js');

const { version } = require('../../../package.json');

const INSTRUCTIONS = [
  'LePatron is an email production platform.',
  'Its expertises are the email know-how of Badsender: read them before advising on an email.',
  'Everything you read here is limited to the group and the rights of the user who connected you.',
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
  // Only for a token that may draft skills and expertises (ADR 0014): the
  // others never see the writing tools.
  if ((authInfo?.scopes || []).includes(WRITE_SCOPE)) {
    registerAuthoringTools(server);
  }
  return server;
}

module.exports = { createMcpServer };
