'use strict';

// The candidates of a convergence (ADR 0021): the open retex a super admin is
// answered when they report one, for them to judge whether two point the same
// way. Which retex meet is asked of the database, never filtered after
// reading: a page holds the latest of them, and list_retex reads the others.

// A part of the email, as stored: trimmed and in lower case (ADR 0021).
const partOf = (part) => String(part).trim().toLowerCase();

// The same text, whatever its spacing and case: a quotation is stored so
// too (`flatQuote`), for two of them to be matched in a query.
const flat = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// A retex with no passage meets every passage of its skill or expertise.
const PASSAGELESS = { section: null, quote: null };

// The quotations that overlap `quote`, flat: one holds the other. A literal,
// never a path: a quotation may start with `$`. A retex without a quotation
// holds none, and is held by none.
function overlapping(quote) {
  const text = { $literal: quote };
  return {
    $expr: {
      $or: [
        { $gte: [{ $indexOfCP: [{ $ifNull: ['$flatQuote', ''] }, text] }, 0] },
        {
          $gte: [
            {
              $indexOfCP: [
                text,
                { $ifNull: ['$flatQuote', { $literal: `${quote} ` }] },
              ],
            },
            0,
          ],
        },
      ],
    },
  };
}

// On the same skill or expertise, the retex that meet this passage: the same
// section, quotations that overlap, or none named on one side.
function passageQuery(retex) {
  if (retex.section) {
    return { $or: [{ section: String(retex.section) }, PASSAGELESS] };
  }
  const quote = flat(retex.quote);
  if (quote) return { $or: [PASSAGELESS, overlapping(quote)] };
  return {};
}

/**
 * The query of the open retex that may converge with this one: on the same
 * skill or expertise, those meeting its passage; about none, the same kind
 * of know-how, and the same part of the email when both name one.
 *
 * @param {Object} retex as reported, or as stored
 * @param {string} retexId left out
 * @returns {Object} a MongoDB filter, of values only
 */
function candidatesQuery(retex, retexId) {
  const others = { status: 'open', _id: { $ne: String(retexId) } };
  if (!retex.about) {
    // The same kind of know-how; and the same part of the email, or none,
    // when this one names a part.
    return {
      ...others,
      about: null,
      category: String(retex.category),
      ...(retex.part && {
        $or: [{ part: partOf(retex.part) }, { part: null }],
      }),
    };
  }
  return {
    ...others,
    'about.kind': String(retex.about.kind),
    'about.id': String(retex.about.id),
    ...passageQuery(retex),
  };
}

module.exports = { candidatesQuery, flat, partOf };
