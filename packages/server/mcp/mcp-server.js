'use strict';

const { McpServer } = require('@modelcontextprotocol/server');
const {
  registerExpertiseResources,
  registerFindApplicableExpertises,
} = require('./mcp-expertises.js');

const { version } = require('../../../package.json');

const INSTRUCTIONS = [
  'LePatron is an email production platform.',
  'Its expertises are the email know-how of Badsender: read them before advising on an email.',
  'Everything you read here is limited to the group and the rights of the user who connected you.',
].join(' ');

/**
 * A fresh MCP server (ADR 0012): it keeps no state, so the HTTP endpoint
 * builds one per request, and each handler resolves who calls from the
 * validated token the transport hands it.
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
  return server;
}

module.exports = { createMcpServer };
