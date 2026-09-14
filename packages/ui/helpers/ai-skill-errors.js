// Turn a server error or coherence warning into a sentence in the user's
// language.
//
// The server sends identifiers, not prose: an error's `message` is an
// ERROR_CODES entry and a warning carries a `code`, each with the data the
// sentence interpolates (`schemaId`, `fields`). The wording lives in the
// locales, under `aiSkills.errors.*` and `aiSkills.warnings.*`.
//
// `vm` is the component instance (for $t).

// Arrays read better joined than as "a,b".
function interpolatable(payload = {}) {
  const params = { ...payload };
  if (Array.isArray(params.fields)) params.fields = params.fields.join(', ');
  return params;
}

/**
 * @param {Object} vm component instance
 * @param {Error} err an axios error
 * @returns {string} the translated message, the raw server message when the
 *   code is unknown, or the generic fallback when there is nothing usable.
 */
export function skillErrorMessage(vm, err) {
  const data = (err && err.response && err.response.data) || {};
  const code = data.message;
  if (code) {
    const key = `aiSkills.errors.${code}`;
    const label = vm.$t(key, interpolatable(data));
    // vue-i18n echoes the key back when there is no entry for it.
    if (label !== key) return label;
    return code;
  }
  return vm.$t('global.errors.errorOccured');
}

/**
 * @param {Object} vm component instance
 * @param {{code: string}} warning one entry of a save response's `warnings`
 * @returns {string}
 */
export function skillWarningMessage(vm, warning) {
  if (!warning) return '';
  // Tolerates the previous contract, where warnings were already sentences.
  if (typeof warning === 'string') return warning;
  const key = `aiSkills.warnings.${warning.code}`;
  const label = vm.$t(key, interpolatable(warning));
  return label === key ? warning.code : label;
}
