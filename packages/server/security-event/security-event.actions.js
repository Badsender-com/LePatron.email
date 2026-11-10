'use strict';

// The actions a security event records (ADR 0008), and the two-factor
// methods it names, in one place that depends on no module: the schema of
// the events reads them all, and each module records its own.

// An account's two-factor authentication, and the company's requirement of it.
const TWO_FACTOR_ACTIONS = Object.freeze({
  RESET: 'two-factor.reset',
  REQUIRED: 'two-factor.required',
  NOT_REQUIRED: 'two-factor.not-required',
  SET_UP: 'two-factor.set-up',
  RECOVERY_CODE_USED: 'two-factor.recovery-code-used',
  DEVICE_TRUSTED: 'two-factor.device-trusted',
  WRONG_CODES: 'two-factor.wrong-codes',
});

// The verification methods of two-factor authentication, which an event of
// it names. Two-factor reads them from here.
const TWO_FACTOR_METHODS = Object.freeze({ TOTP: 'totp', EMAIL: 'email' });

// A company's MCP access (ADR 0012).
const MCP_ACCESS_ACTIONS = Object.freeze({
  ENABLED: 'mcp-access.enabled',
  DISABLED: 'mcp-access.disabled',
});

// A company's MCP module, which a super admin opens or closes (ADR 0017).
const MCP_MODULE_ACTIONS = Object.freeze({
  OPENED: 'mcp-module.opened',
  CLOSED: 'mcp-module.closed',
});

// Whether a company lets the summaries of its assistants' sessions be kept
// for the platform company (ADR 0012).
const RETEX_ACTIONS = Object.freeze({
  ALLOWED: 'retex.allowed',
  DISALLOWED: 'retex.disallowed',
});

// A client a company registers by hand for its assistants (ADR 0012).
const MCP_CLIENT_ACTIONS = Object.freeze({
  CREATED: 'mcp-client.created',
  DELETED: 'mcp-client.deleted',
});

// Every connected application of a company revoked at once (ADR 0012).
const CONNECTED_APPLICATION_ACTIONS = Object.freeze({
  ALL_REVOKED: 'connected-applications.all-revoked',
});

// A read token of production, which a copy reads its skills and expertises
// with (ADR 0019).
const SKILLS_READ_TOKEN_ACTIONS = Object.freeze({
  CREATED: 'skills-read-token.created',
  REVOKED: 'skills-read-token.revoked',
});

// How long a security event is kept, then removed by its TTL index.
const SECURITY_EVENT_TTL_SECONDS = 365 * 24 * 60 * 60;

const SECURITY_EVENT_ACTIONS = Object.freeze([
  ...Object.values(TWO_FACTOR_ACTIONS),
  ...Object.values(MCP_ACCESS_ACTIONS),
  ...Object.values(MCP_MODULE_ACTIONS),
  ...Object.values(RETEX_ACTIONS),
  ...Object.values(MCP_CLIENT_ACTIONS),
  ...Object.values(CONNECTED_APPLICATION_ACTIONS),
  ...Object.values(SKILLS_READ_TOKEN_ACTIONS),
]);

module.exports = {
  TWO_FACTOR_ACTIONS,
  TWO_FACTOR_METHODS,
  MCP_ACCESS_ACTIONS,
  MCP_MODULE_ACTIONS,
  RETEX_ACTIONS,
  MCP_CLIENT_ACTIONS,
  CONNECTED_APPLICATION_ACTIONS,
  SKILLS_READ_TOKEN_ACTIONS,
  SECURITY_EVENT_ACTIONS,
  SECURITY_EVENT_TTL_SECONDS,
};
