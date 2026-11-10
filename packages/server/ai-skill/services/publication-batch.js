'use strict';

/**
 * Publishing several drafts at once (ADR 0019, #1431): one guard over
 * everything the drafts touch, each test case replayed once with every new
 * version in place, then the publications one by one, with a report. One
 * failure stops nothing else; each decision is recorded with its version.
 */

const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const { asList, describeFeature } = require('./feature-use.js');
const { keyOf, loadMany, usesOf } = require('./publication-target.js');
const { planRuns, replay } = require('./publication-guard.js');
const { findVersion } = require('./version-helpers.js');
const publication = require('./skills-publication.service.js');

const summaryOf = ({ kind, id, version }) => ({
  kind,
  id,
  version: { major: version.major, minor: version.minor },
});

// Why one publication failed, as a word the back office translates.
function failureReason(err) {
  const status = err && (err.status || err.statusCode);
  if (err && err.message === ERROR_CODES.SKILL_PUBLICATION_GUARD_REQUIRED) {
    return 'guard_required';
  }
  if (err && err.message === ERROR_CODES.SKILL_VERSION_CHANGED) {
    return 'draft_changed';
  }
  if (status === 404) return 'not_found';
  if (status === 409) return 'not_draft';
  if (status === 400 && /releaseNotes/.test(err.message)) {
    return 'release_notes_required';
  }
  return 'failed';
}

// A draft is published with the changelog and release notes it holds, on the
// condition that it was not written since the page read it (ADR 0014).
function payloadOf(target, doc) {
  const draft =
    doc && findVersion(doc, target.version.major, target.version.minor);
  return {
    changelog: draft ? draft.changelog : undefined,
    releaseNotes: draft ? draft.releaseNotes : undefined,
    updatedAt: target.readAt,
  };
}

/**
 * The draft each selected item would publish. An item with no draft, with
 * several, or archived is left out, with why: several drafts are published
 * from the item's own page, where the person picks one. So is a draft its
 * publication would refuse anyway (checkPublication), before the guard
 * replays anything for it.
 *
 * @param {Array<{ kind: 'skill'|'expertise', id: string }>} items
 * @returns {Promise<{ targets: Array<{ kind, id, version }>,
 *   skipped: Array<{ kind, id, reason, message? }> }>} `reason`:
 *   `not_found`, `archived`, `no_draft`, `several_drafts`, or why its
 *   publication would fail (failureReason), with the error code as `message`
 */
async function draftsToPublish(items) {
  const docs = await loadMany(asList(items));
  const outcomes = await Promise.all(
    asList(items).map(async ({ kind, id, updatedAt }) => {
      const doc = docs.get(keyOf({ kind, id }));
      const drafts = doc
        ? asList(doc.versions).filter((v) => v.status === 'DRAFT')
        : [];
      let reason = null;
      if (!doc) reason = 'not_found';
      else if (doc.status === SkillStatuses.ARCHIVED) reason = 'archived';
      else if (!drafts.length) reason = 'no_draft';
      else if (drafts.length > 1) reason = 'several_drafts';
      if (reason) return { skipped: { kind, id, reason } };
      const [draft] = drafts;
      const target = {
        kind,
        id,
        version: { major: draft.versionMajor, minor: draft.versionMinor },
        // When the draft was last written, for the page to send back: a
        // draft written since is not published (ADR 0014).
        updatedAt: draft.updatedAt,
        ...(updatedAt && { readAt: updatedAt }),
      };
      try {
        await publication.checkPublication(target, doc, payloadOf(target, doc));
      } catch (err) {
        return {
          skipped: {
            kind,
            id,
            reason: failureReason(err),
            message: err.message,
          },
        };
      }
      return { target };
    })
  );
  return {
    targets: outcomes.filter((o) => o.target).map((o) => o.target),
    skipped: outcomes.filter((o) => o.skipped).map((o) => o.skipped),
  };
}

// The features the drafts reach, and the runs of their one replay.
async function planOf(targets) {
  const docs = await loadMany(targets);
  const features = new Map();
  const skillIds = new Set();
  targets.forEach((target) => {
    const manifests = usesOf(target.kind, docs.get(keyOf(target)));
    manifests.forEach((m) => features.set(m.featureType, describeFeature(m)));
    if (!manifests.length) return;
    if (target.kind === 'skill') skillIds.add(target.id);
    else
      manifests.forEach((m) =>
        asList(m.usedSkills).forEach((s) => skillIds.add(s))
      );
  });
  const drafts = new Map(
    targets.filter((t) => t.kind === 'skill').map((t) => [t.id, t.version])
  );
  const plan = await planRuns({ skillIds: [...skillIds], drafts });
  return { usedBy: [...features.values()], plan };
}

/**
 * What one guard over the drafts would replay, without calling the AI.
 *
 * @param {Array<{ kind, id, version }>} targets
 * @returns {Promise<{ usedBy, calls, missing }>}
 */
async function planMany(targets) {
  const { usedBy, plan } = await planOf(targets);
  return { usedBy, calls: plan.calls, missing: plan.missing };
}

/**
 * One guard over everything the drafts touch: each case of each feature skill
 * reached is replayed once, before with the active versions, after with every
 * draft in place. Publishes nothing.
 *
 * @param {Array<{ kind, id, version }>} targets
 * @returns {Promise<{ usedBy, calls, cases, missing }>}
 */
async function guardMany(targets) {
  const { usedBy, plan } = await planOf(targets);
  const overrides = targets
    .filter((t) => t.kind === 'expertise')
    .map(({ id, version }) => ({ id, version }));
  const cases = await replay({ runs: plan.runs, overrides });
  return { usedBy, calls: plan.calls, cases, missing: plan.missing };
}

/**
 * Publish the drafts one by one, after their guard. One failure stops
 * nothing else.
 *
 * @param {Array<{ kind, id, version }>} targets
 * @param {{ guard?: Object, application?: string }} options the guard that
 *   ran over all of them
 * @param {{ id: string }} user
 * @returns {Promise<{ published: Array<{ kind, id, version, warnings? }>,
 *   failed: Array<{ kind, id, version, reason, message }> }>}
 */
async function publishMany(targets, { guard, application } = {}, user) {
  const report = { published: [], failed: [] };
  const docs = await loadMany(asList(targets));
  for (const target of asList(targets)) {
    try {
      const payload = payloadOf(target, docs.get(keyOf(target)));
      // eslint-disable-next-line no-await-in-loop
      const { doc, warnings } = await publication.publishVersion(
        { ...target, guard, payload, application },
        user
      );
      // What a publication warns of, as on the item's own page (ADR 0013).
      const warned = [
        ...warnings,
        // eslint-disable-next-line no-await-in-loop
        ...(await publication.consumedWarningsOf(target, doc)),
      ];
      report.published.push({
        ...summaryOf(target),
        ...(warned.length && { warnings: warned }),
      });
    } catch (err) {
      report.failed.push({
        ...summaryOf(target),
        reason: failureReason(err),
        message: err.message,
      });
    }
  }
  return report;
}

/** Record, on each draft, that the person cancelled after their guard. */
async function cancelMany(targets, { guard } = {}, user) {
  for (const target of asList(targets)) {
    // eslint-disable-next-line no-await-in-loop
    await publication.cancelPublication({ ...target, guard }, user);
  }
  return { cancelled: asList(targets).map(summaryOf) };
}

module.exports = {
  cancelMany,
  draftsToPublish,
  guardMany,
  planMany,
  publishMany,
};
