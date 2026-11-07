'use strict';

// The retex a draft addresses (ADR 0021): the writing tools of ADR 0014 cite
// the open retex a change addresses, and the draft's version holds them
// until its publication closes them.

const { z } = require('zod');
const createError = require('http-errors');
const { notOpen } = require('./mcp-retex-status.js');

const MAX_ID_LENGTH = 100;
const MAX_CITED_RETEX = 50;

// The argument every writing tool takes.
const addressesRetex = z
  .array(z.string().max(MAX_ID_LENGTH))
  .max(MAX_CITED_RETEX)
  .optional()
  .describe(
    'The open retex this change addresses, as list_retex gives them: they are closed when the version is published.'
  );

// What every writing tool answers of them.
const addressedRetex = z
  .array(z.string())
  .describe('The retex the draft addresses, closed when it is published.');

// The retex a draft may cite: open ones only. Checked before a draft is
// started, so that a refusal leaves nothing behind.
async function assertCitable(retexIds) {
  if (!retexIds || !retexIds.length) return;
  const refused = await notOpen(retexIds);
  if (refused.length) {
    throw createError(
      422,
      `Not an open retex: ${refused.join(
        ', '
      )}. Cite only open retex, as list_retex gives them.`
    );
  }
}

// The draft's citations once this proposal is written: added to those of
// the proposals before it, on the document read again.
async function citeIn(service, id, version, retexIds, userId) {
  if (!retexIds || !retexIds.length) return version.retexIds || [];
  return service.citeRetex(
    id,
    { major: version.versionMajor, minor: version.versionMinor },
    retexIds,
    userId
  );
}

module.exports = { addressesRetex, addressedRetex, assertCitable, citeIn };
