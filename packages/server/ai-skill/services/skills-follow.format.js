'use strict';

/**
 * What production answers a copy that follows it (ADR 0019), written and
 * read here only: production produces it, a copy reads it.
 *
 * Every item, archived ones included, with its state, its audience, its
 * served-to-assistants mark, its active version and its open draft; no
 * history and no owner: what a copy lives is what clients live, not who
 * wrote it. An item holding no version has nothing to follow, and is left
 * out.
 *
 * The answer has its own format number (`followFormat`), apart from the
 * skills export's file (ADR 0018). A copy reads its own format and the one
 * before it, so that a copy deployed ahead of production, as during a
 * walkthrough, still follows it. Production's first answers carried the
 * skills export's `format: 1` and no `followFormat`: they read as format 1.
 *
 * An item this copy cannot read is refused alone, with the field refused;
 * the others are followed. Only an answer whose envelope cannot be read is
 * refused whole.
 */

const { z } = require('zod');
const ERROR_CODES = require('../../constant/error-codes.js');
const { Audiences, AudienceValues } = require('../constant/skill-constants.js');
const { ITEM_SCHEMAS } = require('./skills-export.format.js');
const {
  identityOf,
  versionOfKind,
  everyItem,
  byId,
} = require('./skills-export.service.js');
const { findActiveVersion, openDraftOf } = require('./version-helpers.js');

const FOLLOW_FORMAT = 2;
const READABLE_FORMATS = [FOLLOW_FORMAT, FOLLOW_FORMAT - 1];

const KINDS = [
  { kind: 'expertise', list: 'expertises', idField: 'expertiseId' },
  { kind: 'skill', list: 'skills', idField: 'skillId' },
];

// An item as this format carries it. Strict: a key it does not know refuses
// the item rather than lose the field without saying so; a field added to
// what production answers changes FOLLOW_FORMAT.
function itemSchema(kind) {
  const base = ITEM_SCHEMAS[kind];
  const version = base.shape.version.strict();
  const item = base.extend({
    status: z.enum(['active', 'draft', 'archived']),
    audience: z.enum(AudienceValues),
    version: version.optional(),
    draft: version.optional(),
  });
  return (kind === 'skill'
    ? item.extend({ servedToAssistants: z.boolean() })
    : item
  ).strict();
}
const ITEMS = {
  expertise: itemSchema('expertise'),
  skill: itemSchema('skill'),
};

const ENVELOPE = z
  .object({
    origin: z.string(),
    exportedAt: z.string(),
    exportedBy: z.string(),
    expertises: z.array(z.unknown()),
    skills: z.array(z.unknown()),
  })
  .passthrough();

// ─── Production's side ─────────────────────────────────────────────────────

/**
 * An item as production answers it, or null when it holds no version.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} doc the stored item, lean
 * @returns {Object|null}
 */
function itemForCopies(kind, doc) {
  const active = findActiveVersion(doc);
  const draft = openDraftOf(doc);
  if (!active && !draft) return null;
  const item = {
    ...identityOf(kind, doc),
    status: String(doc.status).toLowerCase(),
    audience: doc.audience || Audiences.PLATFORM,
  };
  if (kind === 'skill') item.servedToAssistants = !!doc.servedToAssistants;
  if (active) item.version = versionOfKind(kind, active);
  if (draft) item.draft = versionOfKind(kind, draft);
  return item;
}

const itemsForCopies = async (kind, idField) =>
  (await everyItem(kind))
    .map((doc) => itemForCopies(kind, doc))
    .filter(Boolean)
    .sort(byId(idField));

/**
 * Everything production holds, as a copy follows it: the read route's
 * answer to a read token.
 *
 * @param {Object} [context]
 * @param {string} [context.origin] the instance answering
 * @param {string} [context.by] who reads it: the read token's name
 * @returns {Promise<Object>}
 */
async function exportForCopies({ origin = '', by = '' } = {}) {
  return {
    followFormat: FOLLOW_FORMAT,
    origin,
    exportedAt: new Date().toISOString(),
    exportedBy: by,
    expertises: await itemsForCopies('expertise', 'expertiseId'),
    skills: await itemsForCopies('skill', 'skillId'),
  };
}

// ─── The copy's side ───────────────────────────────────────────────────────

const formatOf = (json) => {
  if (json.followFormat !== undefined) return json.followFormat;
  // Production's first answers (#1424), before the format had its number.
  return json.format === 1 ? 1 : undefined;
};

// An answer this copy cannot read at all, in a word the page translates
// (`reason`), a code, and a sentence for the logs (`message`).
const unreadable = (message) =>
  Object.assign(new Error(message), {
    reason: 'unreadable',
    code: ERROR_CODES.SKILLS_FOLLOW_UNREADABLE,
  });

// Reads the items of one list, each on its own: an item refused is said,
// with the field refused, and the others go on.
function readItems({ kind, list, idField }, raws, rejected) {
  const seen = new Set();
  const read = [];
  raws.forEach((raw, index) => {
    const id = raw && typeof raw[idField] === 'string' ? raw[idField] : null;
    const refuse = (path) =>
      rejected.push({
        kind,
        id,
        code: ERROR_CODES.SKILLS_FOLLOW_ITEM_UNREADABLE,
        field: [list, index, ...path].join('.'),
      });
    const parsed = ITEMS[kind].safeParse(raw);
    if (!parsed.success) {
      refuse(parsed.error.issues[0].path);
    } else if (seen.has(id)) {
      refuse([idField]);
    } else {
      seen.add(id);
      read.push(parsed.data);
    }
  });
  return read;
}

/**
 * Production's answer, read: its envelope whole, its items one by one.
 *
 * @param {Object} json production's answer
 * @returns {{ origin: string, exportedAt: string, exportedBy: string,
 *   expertises: Object[], skills: Object[], rejected: Object[] }} the items
 *   this copy reads, and those it refuses (`{ kind, id, code, field }`)
 * @throws {Error} with `reason` and `code`, when the answer cannot be read
 */
function readProductionAnswer(json) {
  const format = json && formatOf(json);
  if (!READABLE_FORMATS.includes(format)) {
    throw unreadable(
      `Production answered an unknown format (${format}); this copy reads formats ${READABLE_FORMATS.join(
        ' and '
      )}.`
    );
  }
  const envelope = ENVELOPE.safeParse(json);
  if (!envelope.success) {
    const [issue] = envelope.error.issues;
    throw unreadable(
      `Production answered something this copy cannot read: ${issue.path.join(
        '.'
      )} ${issue.message}`
    );
  }
  const { origin, exportedAt, exportedBy } = envelope.data;
  const rejected = [];
  const answer = { origin, exportedAt, exportedBy, rejected };
  KINDS.forEach((kind) => {
    answer[kind.list] = readItems(kind, envelope.data[kind.list], rejected);
  });
  return answer;
}

module.exports = {
  FOLLOW_FORMAT,
  READABLE_FORMATS,
  ITEMS,
  KINDS,
  itemForCopies,
  exportForCopies,
  readProductionAnswer,
};
