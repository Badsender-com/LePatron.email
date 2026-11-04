'use strict';

/**
 * Publishing several drafts at once (ADR 0019, #1431): one guard over
 * everything the drafts touch, each test case replayed once with every new
 * version in place, then the publications one by one, with a report. One
 * failure stops nothing else; each decision is recorded with its version.
 */

const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const { asList, describeFeature } = require('./feature-use.js');
const { planRuns, replay } = require('./publication-guard.js');
const { findVersion } = require('./version-helpers.js');

const ID_FIELDS = { skill: 'skillId', expertise: 'expertiseId' };
const MODELS = { skill: LePatronSkills, expertise: Expertises };

// Read when called: this module is itself read by the publication service.
const publication = () => require('./skills-publication.service.js');

const summaryOf = ({ kind, id, version }) => ({
  kind,
  id,
  version: { major: version.major, minor: version.minor },
});

/**
 * The draft each selected item would publish. An item with no draft, with
 * several, or archived is left out, with why: several drafts are published
 * from the item's own page, where the person picks one.
 *
 * @param {Array<{ kind: 'skill'|'expertise', id: string }>} items
 * @returns {Promise<{ targets: Array<{ kind, id, version }>,
 *   skipped: Array<{ kind, id, reason }> }>} `reason`: `not_found`,
 *   `archived`, `no_draft` or `several_drafts`
 */
async function draftsToPublish(items) {
  const targets = [];
  const skipped = [];
  for (const { kind, id, updatedAt } of asList(items)) {
    const idField = ID_FIELDS[kind];
    // eslint-disable-next-line no-await-in-loop
    const doc = idField
      ? await MODELS[kind]
          .findOne({ [idField]: id }, { status: 1, versions: 1 })
          .lean()
      : null;
    const drafts = doc
      ? asList(doc.versions).filter((v) => v.status === 'DRAFT')
      : [];
    let reason = null;
    if (!doc) reason = 'not_found';
    else if (doc.status === SkillStatuses.ARCHIVED) reason = 'archived';
    else if (!drafts.length) reason = 'no_draft';
    else if (drafts.length > 1) reason = 'several_drafts';
    if (reason) {
      skipped.push({ kind, id, reason });
    } else {
      const [draft] = drafts;
      targets.push({
        kind,
        id,
        version: { major: draft.versionMajor, minor: draft.versionMinor },
        // When the draft was last written, for the page to send back: a
        // draft written since is not published (ADR 0014).
        updatedAt: draft.updatedAt,
        ...(updatedAt && { readAt: updatedAt }),
      });
    }
  }
  return { targets, skipped };
}

// The features the drafts reach, and the runs of their one replay.
async function planOf(targets) {
  const uses = [];
  for (const target of targets) {
    // eslint-disable-next-line no-await-in-loop
    const { manifests } = await publication().loadUse(target);
    uses.push({ target, manifests });
  }
  const features = new Map();
  const skillIds = new Set();
  uses.forEach(({ target, manifests }) => {
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
async function payloadOf(target) {
  const { doc } = await publication().loadUse(target);
  const draft = findVersion(doc, target.version.major, target.version.minor);
  return {
    changelog: draft.changelog,
    releaseNotes: draft.releaseNotes,
    updatedAt: target.readAt,
  };
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
  for (const target of asList(targets)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const payload = await payloadOf(target);
      // eslint-disable-next-line no-await-in-loop
      const { doc, warnings } = await publication().publishVersion(
        { ...target, guard, payload, application },
        user
      );
      // What a publication warns of, as on the item's own page (ADR 0013).
      const warned = [
        ...warnings,
        // eslint-disable-next-line no-await-in-loop
        ...(await publication().consumedWarningsOf(target, doc)),
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
    await publication().cancelPublication({ ...target, guard }, user);
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
