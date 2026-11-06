'use strict';

// What every LePatron tool says the same way: how it fails, and what it may
// do. The annotations are written out in full, since a client that misses one
// assumes the worst (a destructive write reaching the open world), and the
// ChatGPT review asks for the three of them on every tool.

/** A tool that could not do what was asked: the model reads why. */
const failure = (text) => ({
  isError: true,
  content: [{ type: 'text', text }],
});

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

/** A setting of the connection: the same call gives the same state. */
const SETTING = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

module.exports = { failure, READ_ONLY, ADDITIVE, OVERWRITING, SETTING };
