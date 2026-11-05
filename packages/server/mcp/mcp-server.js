'use strict';

const { McpServer } = require('@modelcontextprotocol/server');
const { guardListing } = require('./mcp-identity.js');
const { registerExpertiseResources } = require('./mcp-expertises.js');
const {
  registerFindApplicableExpertises,
  withScopesDescribed,
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
 * builds one per request, and every handler resolves who calls from the
 * validated token the transport hands it (`withIdentity`), the listings the
 * SDK answers itself included. Only `initialize` and `ping` answer anyone.
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
  guardListing(server, 'tools/list', withScopesDescribed);
  guardListing(server, 'resources/templates/list');
  return server;
}

module.exports = { createMcpServer };
