'use strict';

// The candidates of a convergence (ADR 0021): the open retex a super admin is
// answered when they report one, for them to judge whether two point the same
// way.

const { McpRetexes } = require('../common/models.common.js');
const { readableAll, partOf } = require('./mcp-retex-read.js');

// The same text, whatever its spacing and case.
const flat = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// How many candidates a super admin reads at most, the latest first.
const MAX_CANDIDATES = 50;

// Whether another retex on the same skill or expertise meets this passage:
// the same section, or none named on one side; quotations that overlap,
// whatever their spacing and case.
function meetsPassage(retex, other) {
  const passageless = (r) => !r.section && !r.quote;
  if (passageless(retex) || passageless(other)) return true;
  if (retex.section) return other.section === retex.section;
  if (!retex.quote || !other.quote) return false;
  const [a, b] = [flat(retex.quote), flat(other.quote)];
  return a.includes(b) || b.includes(a);
}

// The open retex that may converge with this one, for a super admin to
// judge, filtered before anything is cut: on the same skill or expertise,
// those meeting its passage; about none, the same kind of know-how and part
// of the email (ADR 0021).
async function candidatesOf(retex, retexId) {
  const query = retex.about
    ? {
        status: 'open',
        'about.kind': retex.about.kind,
        'about.id': retex.about.id,
      }
    : {
        status: 'open',
        about: null,
        category: retex.category,
        part: partOf(retex.part),
      };
  const found = await McpRetexes.find(query).sort({ createdAt: -1 }).lean();
  const meeting = found
    .filter((other) => String(other._id) !== retexId)
    .filter((other) => !retex.about || meetsPassage(retex, other))
    .slice(0, MAX_CANDIDATES);
  return readableAll(meeting);
}

module.exports = { candidatesOf, flat };
