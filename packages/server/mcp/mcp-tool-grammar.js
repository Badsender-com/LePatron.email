'use strict';

// What every LePatron tool says the same way: what it may do, in five
// presets. They are written out in full, since a client that misses one
// assumes the worst (a destructive write reaching the open world), and the
// ChatGPT review asks for the three of them on every tool. How a tool fails is
// said with the identity (`failure`, mcp-identity.js), as its answers are.

/** Reads LePatron, changes nothing. */
const READ_ONLY = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
});

/** Adds something to LePatron, overwrites nothing. */
const ADDITIVE = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
});

/** Rewrites what is there: an open draft. */
const OVERWRITING = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
});

/** Replaces a state with the one given: the same call gives the same state. */
const SWITCHING = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
});

/** A setting of the connection: the same call gives the same state. */
const SETTING = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

module.exports = {
  READ_ONLY,
  ADDITIVE,
  OVERWRITING,
  SWITCHING,
  SETTING,
};
