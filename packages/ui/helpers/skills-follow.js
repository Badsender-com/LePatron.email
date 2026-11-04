// What the Sync tab of a copy shows of its follows of production (ADR 0019):
// the rules the tab reads, tested on their own, as the project mounts no
// component in its tests.

// The outcomes of a follow, in the order the tab shows them.
export const FOLLOW_OUTCOMES = [
  'created',
  'updated',
  'upToDate',
  'kept',
  'failed',
];

// The outcomes the last follow holds, the empty ones left out.
export function followOutcomes(last) {
  if (!last) return [];
  return FOLLOW_OUTCOMES.map((outcome) => ({
    outcome,
    count: last[outcome] || 0,
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

const STATUS_COLORS = {
  succeeded: 'success',
  partial: 'warning',
  failed: 'error',
};

export function followStatusColor(status) {
  return STATUS_COLORS[status] || 'grey';
}
