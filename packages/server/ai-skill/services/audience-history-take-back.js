'use strict';

/**
 * Taking back the past openings and withdrawals of the skills and expertises
 * (ADR 0031), before their audience kept its history: only from what the call
 * log still holds of the audiences set through an assistant, applied, by
 * whom and when. The back office's changes left no trace, and the log goes
 * at the end of each company's retention: an item the log does not know
 * gets nothing, never a guessed date. Run dry first; a person validates what
 * it found, then it writes.
 */

const {
  Expertises,
  LePatronSkills,
  McpCallLogs,
} = require('../../common/models.common.js');
const { AudienceValues } = require('../constant/skill-constants.js');

// What set_audience logs when it applied an audience, not when it checked
// one (`:check`): `audience:<audience>` (mcp-call-ids.js).
const APPLIED = AudienceValues.map((audience) => `audience:${audience}`);

const SOURCES = [
  { kind: 'skill', Model: LePatronSkills, idField: 'skillId' },
  { kind: 'expertise', Model: Expertises, idField: 'expertiseId' },
];

const time = (date) => new Date(date).getTime();

// The item an id names, of either kind; none when it names none, or both.
async function itemNamed(id) {
  const found = await Promise.all(
    SOURCES.map(async (source) => {
      const doc = await source.Model.findOne(
        { [source.idField]: id },
        { audienceHistory: 1 }
      ).lean();
      return doc && { ...source, doc };
    })
  );
  const named = found.filter(Boolean);
  return named.length === 1 ? named[0] : null;
}

// The changes the log tells of an item, before the first it keeps, each one
// a change of direction.
function untold(logs, kept) {
  const first = kept.length
    ? Math.min(...kept.map((change) => time(change.at)))
    : Infinity;
  const changes = [];
  logs
    .filter((log) => time(log.createdAt) < first)
    .forEach((log) => {
      const audience = log.change.slice('audience:'.length);
      const previous = changes[changes.length - 1];
      if (previous && previous.audience === audience) return;
      changes.push({
        audience,
        at: new Date(log.createdAt),
        _by: log._user || null,
      });
    });
  return changes;
}

/**
 * @param {{ write?: boolean }} [options] `write`: record what was found;
 *   otherwise only list it
 * @returns {Promise<{ found: Object[], unresolved: string[], written: number }>}
 *   the changes found, the ids the log names that name no single item, and
 *   how many changes were written
 */
async function takeBackAudienceHistory({ write = false } = {}) {
  const logs = await McpCallLogs.find(
    { name: 'set_audience', outcome: 'ok', change: { $in: APPLIED } },
    { objectIds: 1, change: 1, _user: 1, createdAt: 1 }
  ).lean();
  const byId = new Map();
  logs
    .filter((log) => log.objectIds && log.objectIds[0])
    .sort((a, b) => time(a.createdAt) - time(b.createdAt))
    .forEach((log) => {
      const id = log.objectIds[0];
      byId.set(id, [...(byId.get(id) || []), log]);
    });

  const found = [];
  const unresolved = [];
  let written = 0;
  for (const [id, itemLogs] of [...byId.entries()].sort()) {
    // One item at a time: a handful of them, read once each.
    // eslint-disable-next-line no-await-in-loop
    const item = await itemNamed(id);
    if (!item) {
      unresolved.push(id);
      continue;
    }
    const kept = item.doc.audienceHistory || [];
    const changes = untold(itemLogs, kept);
    if (!changes.length) continue;
    changes.forEach((change) =>
      found.push({
        kind: item.kind,
        id,
        audience: change.audience,
        at: change.at.toISOString(),
      })
    );
    if (write) {
      // eslint-disable-next-line no-await-in-loop
      await item.Model.updateOne(
        { _id: item.doc._id },
        { $set: { audienceHistory: [...changes, ...kept] } }
      );
      written += changes.length;
    }
  }
  return { found, unresolved, written };
}

module.exports = { takeBackAudienceHistory };
