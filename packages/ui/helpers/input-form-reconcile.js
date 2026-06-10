// Pure helpers for reconciling a scenario input object with a (new) skill
// input-schema descriptor — extracted from BsAiPlaygroundInputForm to keep
// the component under the 300-line budget and the logic trivially testable.

function isEmptyValue(v) {
  return v === undefined || v === null || v === '';
}

/**
 * Split the input's keys against the known field names of a descriptor.
 * @returns {{ dropped: string[], droppedNonEmpty: string[] }}
 *   dropped = keys the new schema does not know; droppedNonEmpty = the subset
 *   carrying a value worth confirming before deletion.
 */
export function partitionInputKeys(value, knownNames) {
  const dropped = Object.keys(value || {}).filter(
    (k) => !knownNames.includes(k)
  );
  return {
    dropped,
    droppedNonEmpty: dropped.filter((k) => !isEmptyValue(value[k])),
  };
}

/**
 * Keep only the keys the descriptor knows (preserving their values).
 */
export function cleanInput(value, knownNames) {
  const cleaned = {};
  for (const name of knownNames) {
    if (value && value[name] !== undefined) cleaned[name] = value[name];
  }
  return cleaned;
}
