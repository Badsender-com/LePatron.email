// Publishing several drafts at once from the lists (ADR 0019): the rules the
// lists and the batch dialog read, tested on their own, as the project mounts
// no component in its tests.

import { isExportable } from '~/helpers/skills-export-download.js';

// Why the server leaves a selected item out of the batch.
export const PUBLISH_SKIP_REASONS = [
  'not_found',
  'archived',
  'no_draft',
  'several_drafts',
];

// Why one publication of the batch failed.
export const PUBLISH_FAILURE_REASONS = [
  'guard_required',
  'draft_changed',
  'not_found',
  'not_draft',
  'release_notes_required',
  'failed',
];

// A row the lists let the person select: one to export (it has an active
// version) or one never published, whose draft only waits to be.
export function isSelectable(item) {
  return !!item && (isExportable(item) || item.status === 'DRAFT');
}

// Of a selection, what the export takes: what has an active version.
export function exportableOf(selected) {
  return (selected || []).filter(isExportable);
}

// The selection as the server reads it.
export function batchItems(kind, selected, idField) {
  return (selected || []).map((item) => ({ kind, id: item[idField] }));
}

// The drafts to publish as the plan read them: a draft written since is not
// published (ADR 0014).
export function readItems(targets) {
  return (targets || []).map(({ kind, id, updatedAt }) => ({
    kind,
    id,
    updatedAt,
  }));
}

// A guard runs when a feature uses one of the drafts.
export function batchNeedsGuard(plan) {
  return !!plan && Array.isArray(plan.usedBy) && plan.usedBy.length > 0;
}

const keyIn = (list, reason, fallback, prefix) =>
  `${prefix}.${list.includes(reason) ? reason : fallback}`;

export function skipReasonKey(reason) {
  return keyIn(
    PUBLISH_SKIP_REASONS,
    reason,
    'no_draft',
    'aiSkills.publishDrafts.skipped'
  );
}

export function failureReasonKey(reason) {
  return keyIn(
    PUBLISH_FAILURE_REASONS,
    reason,
    'failed',
    'aiSkills.publishDrafts.failures'
  );
}

// An item of the batch as the dialog names it.
export function itemLabel({ id, version }) {
  return version ? `${id} v${version.major}.${version.minor}` : id;
}
