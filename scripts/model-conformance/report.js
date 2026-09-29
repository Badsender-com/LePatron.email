'use strict';

/**
 * Turning probe results into something readable and diffable.
 *
 * Pure, and deliberately free of durations and timestamps: two runs of the
 * same set must differ only where behaviour differs, otherwise the diff is
 * useless and nobody compares anything.
 */

const VERDICTS = Object.freeze({
  OK: 'OK',
  // Worked, but the request had to be corrected on the fly. Counted as a
  // warning: it costs a refused request per model per worker, and it means the
  // fast-path patterns are behind.
  ADAPTED: 'ADAPTED',
  FAIL: 'FAIL',
  // Attempts disagreed. Never resolved either way — a provider that answers
  // differently to the same call is a fact to report, not to average out.
  FLAKY: 'FLAKY',
  TRANSIENT: 'TRANSIENT',
  SKIPPED: 'SKIPPED',
});

const PREFIX = '[check-model-conformance]';

function padded(value, width) {
  return String(value).padEnd(width);
}

/**
 * @param {Array<{provider, integrationId, model, path, verdict, detail}>} results
 * @returns {string}
 */
function formatReport(results) {
  const lines = [];
  const byIntegration = new Map();

  for (const result of results) {
    const key = `${result.provider}|${result.integrationId}`;
    if (!byIntegration.has(key)) byIntegration.set(key, []);
    byIntegration.get(key).push(result);
  }

  for (const [key, group] of byIntegration) {
    const [provider, integrationId] = key.split('|');
    // Truncated: enough to tell two integrations apart, not enough to be an
    // identifier in a pasted log.
    const shortId = String(integrationId).slice(-6);
    lines.push('');
    lines.push(
      `${PREFIX} ${provider} — integration …${shortId} (${group.length} probes)`
    );
    lines.push('');
    lines.push(
      `  ${padded('MODEL', 30)}${padded('PATH', 13)}${padded(
        'VERDICT',
        10
      )}DETAIL`
    );

    const sorted = [...group].sort(
      (a, b) => a.model.localeCompare(b.model) || a.path.localeCompare(b.path)
    );
    for (const row of sorted) {
      lines.push(
        `  ${padded(row.model, 30)}${padded(row.path, 13)}${padded(
          row.verdict,
          10
        )}${row.detail || ''}`.trimEnd()
      );
    }
  }

  lines.push('');
  lines.push(`${PREFIX} summary`);
  const counts = countVerdicts(results);
  lines.push(
    `  ${results.length} probes — ` +
      Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([verdict, n]) => `${n} ${verdict}`)
        .join(', ')
  );

  for (const row of results.filter((r) => r.verdict === VERDICTS.FAIL)) {
    lines.push(`  ✗ ${row.provider}/${row.model} ${row.path} — ${row.detail}`);
  }
  // Naming them is the whole point of the warning. A bare count said
  // "widen the patterns" without saying which, so the first sweep's warning
  // got read and not acted on.
  const adapted = results.filter((r) => r.verdict === VERDICTS.ADAPTED);
  if (adapted.length) {
    lines.push(
      `  ⚠ ${adapted.length} probe(s) needed runtime adaptation — one refused request per model per worker:`
    );
    for (const row of adapted) {
      lines.push(
        `      ${row.provider}/${row.model} ${row.path} — ${row.detail}`
      );
    }
    lines.push(
      '      A rename or a dropped parameter means the fast-path pattern is behind; a clamp is the model stating its own ceiling and needs nothing.'
    );
  }

  return lines.join('\n');
}

function countVerdicts(results) {
  const counts = {};
  for (const verdict of Object.values(VERDICTS)) counts[verdict] = 0;
  for (const result of results) counts[result.verdict] += 1;
  return counts;
}

/**
 * 0 conformant, 1 a structural refusal, 2 warnings only — same scale as
 * check-skill-usage.js.
 */
function exitCodeFor(results) {
  if (results.some((r) => r.verdict === VERDICTS.FAIL)) return 1;
  const warning = new Set([
    VERDICTS.ADAPTED,
    VERDICTS.FLAKY,
    VERDICTS.TRANSIENT,
    VERDICTS.SKIPPED,
  ]);
  if (results.some((r) => warning.has(r.verdict))) return 2;
  return 0;
}

module.exports = { formatReport, exitCodeFor, countVerdicts, VERDICTS, PREFIX };
