// Shared latency formatting. Lists/modals show seconds with one decimal
// ("12,4 s"); the raw millisecond value goes in a tooltip.

export function latencySeconds(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '';
  return `${(Number(ms) / 1000).toFixed(1).replace('.', ',')} s`;
}

export function latencyMillis(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '';
  return `${ms} ms`;
}
