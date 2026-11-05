'use strict';

// The actions a security event records (ADR 0008), in one place that depends
// on no module: the schema of the events reads them all, and each module
// records its own.

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

// A company's MCP access (ADR 0012).
const MCP_ACCESS_ACTIONS = Object.freeze({
  ENABLED: 'mcp-access.enabled',
  DISABLED: 'mcp-access.disabled',
});

const SECURITY_EVENT_ACTIONS = Object.freeze([
  ...Object.values(TWO_FACTOR_ACTIONS),
  ...Object.values(MCP_ACCESS_ACTIONS),
]);

module.exports = {
  TWO_FACTOR_ACTIONS,
  MCP_ACCESS_ACTIONS,
  SECURITY_EVENT_ACTIONS,
};
