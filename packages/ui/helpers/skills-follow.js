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

const STATUS_COLORS = {
  succeeded: 'success',
  partial: 'warning',
  failed: 'error',
};

export function followStatusColor(status) {
  return STATUS_COLORS[status] || 'grey';
}
