/**
 * What the dimension dialog of the taxonomy screen sends, beyond the wording,
 * and the scope it offers (ADR-0024). Pure, so it is tested apart: covered by
 * tests/ui/helpers/taxonomy-dimension-form.test.js.
 */

// Mirrors `DimensionScopes` in packages/server/constant/taxonomy-type.js.
export const SCOPES = Object.freeze(['all', 'readingTemplates']);

/**
 * A standard dimension, and one holding a role, are offered on every email:
 * a translated email must not lose its language because its template does not
 * print it.
 *
 * @param {Object} dimension
 * @param {boolean} [dimension.standard]
 * @param {string} [dimension.role]
 * @returns {boolean}
 */
export function scopeIsFixed({ standard, role }) {
  return Boolean(standard || role);
}

/**
 * The structural fields a request carries: only those that changed, so that a
 * parent deactivated since does not block an edit of the wording. A standard
 * dimension has no parent, role or scope to change; the trigger carries no
 * design token, so no precedence.
 *
 * @param {Object} params
 * @param {Object} params.form `{ name, parentName, role, scope, precedence }`
 * @param {Object} params.initial the same fields, as the dialog opened
 * @param {boolean} params.isStandard
 * @returns {Object}
 */
export function changedDimensionFields({ form, initial, isStandard }) {
  const changes = {};
  if (!isStandard) {
    ['parentName', 'role'].forEach((key) => {
      if (form[key] !== initial[key]) changes[key] = form[key] || null;
    });
    // A role fixes the scope to every email.
    const scope = form.role ? 'all' : form.scope || 'all';
    if (scope !== (initial.scope || 'all')) changes.scope = scope;
  }
  const precedence = Math.trunc(Number(form.precedence));
  if (
    form.name !== 'trigger' &&
    Number.isFinite(precedence) &&
    precedence !== initial.precedence
  ) {
    changes.precedence = precedence;
  }
  return changes;
}
