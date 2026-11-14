/**
 * What the template page says of a template's contract (ADR-0024): the root
 * properties the template declares or reads, which decide the dimensions its
 * emails offer. Covered by tests/ui/helpers/template-contract.test.js.
 *
 * @param {Object} [contract] `{ declared, read, adopt }`
 * @returns {{names: string[], adopted: Array<{name: string, source: string}>}}
 */
export function contractSummary(contract) {
  const declared = Object.keys(contract?.declared || {});
  const read = contract?.read || [];
  const adopt = contract?.adopt || {};
  return {
    names: [...new Set([...declared, ...read])].sort((a, b) =>
      a.localeCompare(b)
    ),
    adopted: Object.keys(adopt)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, source: adopt[name] })),
  };
}
