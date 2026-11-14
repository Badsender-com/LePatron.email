/**
 * The rows of the adoption preview of a template's emails (ADR-0024): the
 * emails adoption would attach or cannot, the complete ones left out, those
 * with a gap first.
 *
 * @param {Object} report what the server answers, `{ emails, counts }`
 * @returns {Array<{id: string, name: string, adopted: Array<{dimension: string, identifier: string}>, gaps: Array}>}
 */
export function adoptionRows(report) {
  return (report?.emails || [])
    .filter(
      (entry) =>
        entry.gaps.length > 0 || Object.keys(entry.adopted || {}).length > 0
    )
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      adopted: Object.entries(
        entry.adopted || {}
      ).map(([dimension, identifier]) => ({ dimension, identifier })),
      gaps: entry.gaps,
    }))
    .sort((a, b) => b.gaps.length - a.gaps.length);
}

/**
 * @param {string} reason `UNKNOWN_IDENTIFIER` or `NOT_OFFERED`
 * @returns {string} the key of its explanation
 */
export function gapReasonKey(reason) {
  return reason === 'NOT_OFFERED'
    ? 'templates.adoption.notOffered'
    : 'templates.adoption.unknownIdentifier';
}
