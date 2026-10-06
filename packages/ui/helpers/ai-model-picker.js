/**
 * Value handling for the AI model picker.
 *
 * Extracted from the component because it is where the subtle behaviour is,
 * and because a helper can be tested — the project has no component-mounting
 * setup.
 */

// Mirrors MODEL_ID_PATTERN in packages/server/ai-feature/ai-feature.service.js.
// Duplicated on purpose: the server guard is the one that matters, but without
// a client-side check the only feedback on a typo is the generic "an error
// occurred" snackbar these tabs raise for any failed save.
export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;

/**
 * Reduce whatever v-combobox emits to a model id, or null.
 *
 * v-combobox emits three different shapes, and conflating them is a real bug
 * rather than a theoretical one:
 *   - an item from the list. Note that v-combobox, unlike v-select, IGNORES
 *     `item-value` and hands back the whole item — so an object reaches us
 *     even when the items carry a `value` field.
 *   - the raw string when the user types an identifier of their own,
 *   - null / '' when the field is cleared.
 *
 * Empty means "provider default": '' is neither undefined nor null, so if it
 * were persisted it would win over the default in the server-side resolver and
 * be sent to the provider as the group's chosen model.
 *
 * @param {Object|string|null} selection
 * @returns {string|null}
 */
export function toModelId(selection) {
  if (selection === null || selection === undefined) return null;

  const raw =
    typeof selection === 'object'
      ? selection.value || selection.id || ''
      : selection;

  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @param {string|null} modelId
 * @returns {boolean} true when the id is empty (meaning "default") or well formed
 */
export function isValidModelId(modelId) {
  if (!modelId) return true;
  return MODEL_ID_PATTERN.test(modelId);
}
