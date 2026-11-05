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
 * `resources/templates/list`), the same for every caller.
 *
 * @returns {McpServer}
 */
function createMcpServer() {
  const server = new McpServer(
    { name: 'lepatron', title: 'LePatron', version },
    { instructions: INSTRUCTIONS }
  );
  registerExpertiseResources(server);
  registerFindApplicableExpertises(server);
  registerSkillPrompts(server);
  registerSkillResources(server);
  registerFindSkills(server);
  return server;
}

module.exports = { createMcpServer };
