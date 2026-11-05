'use strict';

// The security events of a company's MCP access (ADR 0012), kept with those
// of two-factor authentication (ADR 0008). No dependency: the schema of the
// security events reads it.
const MCP_ACCESS_ACTIONS = Object.freeze({
  ENABLED: 'mcp-access.enabled',
  DISABLED: 'mcp-access.disabled',
});

module.exports = { MCP_ACCESS_ACTIONS };
