// What the "Production and copies" tab of a copy shows of its follows of
// production (ADR 0019): the rules the tab reads, tested on their own.

// The outcomes of a follow, in the order the tab shows them.
export const FOLLOW_OUTCOMES = [
  'created',
  'updated',
  'moved',
  'removed',
  'upToDate',
  'kept',
  'failed',
];

// An outcome is a list of items in a report, a count in the last follow.
const countOf = (value) =>
  Array.isArray(value) ? value.length : Number(value) || 0;

// The outcomes the last follow holds, the empty ones left out.
export function followOutcomes(last) {
  if (!last) return [];
  return FOLLOW_OUTCOMES.map((outcome) => ({
    outcome,
    count: countOf(last[outcome]),
  })).filter(({ count }) => count > 0);
}

// Why a follow wrote nothing, as the server words it.
export const FOLLOW_FAILURE_REASONS = [
  'not_configured',
  'invalid_address',
  'unreachable',
  'token_refused',
  'production_error',
  'unreadable',
];

// The words of a failed follow, in the reader's language: an unforeseen
// reason reads as production out of reach.
export function followFailureKey(last) {
  const reason = last && last.reason;
  return `aiSkills.follow.reasons.${
    FOLLOW_FAILURE_REASONS.includes(reason) ? reason : 'unreachable'
  }`;
}

// Who followed: a person's button, or the night's scheduled command.
export function followLastKey(last) {
  return last && last.trigger === 'night'
    ? 'aiSkills.follow.lastNight'
    : 'aiSkills.follow.last';
}

// Who holds the follow running now.
export function followLockKey(lock) {
  return lock && lock.trigger === 'night'
    ? 'aiSkills.follow.lockNight'
    : 'aiSkills.follow.lock';
}

const STATUS_COLORS = {
  succeeded: 'success',
  partial: 'warning',
  failed: 'error',
};

export function followStatusColor(status) {
  return STATUS_COLORS[status] || 'grey';
}

// The words said once a follow ends, and their color: a follow that failed
// for some items is no success.
export function followDoneNotice(status) {
  return status === 'partial'
    ? { key: 'aiSkills.follow.donePartial', color: 'warning' }
    : { key: 'aiSkills.follow.done', color: 'success' };
}

// The page of an item in the back office.
export function itemPath(kind, id) {
  return kind === 'skill' ? `/ai-skills/${id}` : `/ai-expertise/${id}`;
}

// The code a failed item is refused with: words of the application, never
// the server's own sentence.
export function followItemErrorKey(failure) {
  const code = failure && (failure.code || failure.message);
  return code ? `aiSkills.errors.${code}` : null;
}

const listOf = (report, name) =>
  report && Array.isArray(report[name]) ? report[name] : [];

/**
 * What a follow's report says item by item, beyond its counts:
 * - `moved`: the copy's work set aside in a new item of the copy, linked;
 * - `removed`: what production no longer has, gone from the copy;
 * - `kept`: an item kept on the copy that production changed since;
 * - `warnings`: what an item written brings that the copy lacks.
 *
 * @param {Object} [report] a follow's report, or the last follow when it
 *   holds its lists
 * @returns {{ moved: Object[], removed: Object[], kept: Object[],
 *   warnings: Object[] }}
 */
export function followDetails(report) {
  const warnings = FOLLOW_OUTCOMES.flatMap((outcome) =>
    listOf(report, outcome).flatMap((item) =>
      (item.warnings || []).map((warning) => ({
        ...warning,
        kind: item.kind,
        id: item.id,
      }))
    )
  ).concat(listOf(report, 'warnings'));
  return {
    moved: listOf(report, 'moved').map(({ kind, id, copyId }) => ({
      kind,
      id,
      copyId,
      to: itemPath(kind, copyId),
    })),
    removed: listOf(report, 'removed').map(({ kind, id }) => ({ kind, id })),
    kept: listOf(report, 'kept')
      .filter(
        ({ reason, productionChanged }) =>
          reason === 'kept_on_copy' && productionChanged
      )
      .map(({ kind, id }) => ({ kind, id, to: itemPath(kind, id) })),
    warnings: warnings.map((warning) => ({
      ...warning,
      to: warning.id ? itemPath(warning.kind, warning.id) : null,
    })),
  };
}
