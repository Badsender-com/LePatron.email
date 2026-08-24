// Pure helpers for reconciling a scenario input object with a (new) skill
// input-schema descriptor — extracted from BsAiPlaygroundInputForm to keep
// the component under the 300-line budget and the logic trivially testable.

// `expertise` is never part of a descriptor's `fields` (the runner injects it,
// consultants must not type it by hand) but the zod input schema accepts it
// when the skill declares it. It is therefore neither an unknown key nor a
// droppable one — see describe-schema.js.
export const EXPERTISE_KEY = 'expertise';

function acceptsExpertise(descriptor) {
  return !!(descriptor && descriptor.hasExpertiseField);
}

function isEmptyValue(v) {
  return v === undefined || v === null || v === '';
}

/**
 * Split the input's keys against the known field names of a descriptor.
 * `descriptor` is optional; when it declares an expertise field, the
 * `expertise` key is kept rather than dropped.
 * @returns {{ dropped: string[], droppedNonEmpty: string[] }}
 *   dropped = keys the new schema does not know; droppedNonEmpty = the subset
 *   carrying a value worth confirming before deletion.
 */
export function partitionInputKeys(value, knownNames, descriptor) {
  const keep = acceptsExpertise(descriptor)
    ? [...knownNames, EXPERTISE_KEY]
    : knownNames;
  const dropped = Object.keys(value || {}).filter((k) => !keep.includes(k));
  return {
    dropped,
    droppedNonEmpty: dropped.filter((k) => !isEmptyValue(value[k])),
  };
}

/**
 * Keep only the keys the descriptor knows (preserving their values).
 */
export function cleanInput(value, knownNames, descriptor) {
  const keep = acceptsExpertise(descriptor)
    ? [...knownNames, EXPERTISE_KEY]
    : knownNames;
  const cleaned = {};
  for (const name of keep) {
    if (value && value[name] !== undefined) cleaned[name] = value[name];
  }
  return cleaned;
}
