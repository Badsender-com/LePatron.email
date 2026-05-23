import slugify from './slugify.js';

/**
 * Build a suggested dot-hierarchical identifier from the structured fields
 * of a Skill or Expertise creation form.
 *
 * Skill format:      <category>.<title>
 * Expertise format:  <category>.<firstScope>.<title>
 *
 * Parts that slugify to an empty string are skipped — so an empty title
 * leaves the suggestion empty rather than producing a trailing dot.
 *
 * @param {Object} params
 * @param {string} [params.category] — DB enum value (already slug-like)
 * @param {string} [params.title]
 * @param {string|string[]} [params.scope] — optional, expertise-only.
 *        Only the first non-empty value is used.
 * @returns {string}
 */
export default function suggestIdentifier({ category, title, scope } = {}) {
  const parts = [];

  if (category) parts.push(slugify(category));

  if (Array.isArray(scope)) {
    const first = scope.find((s) => !!s && String(s).trim());
    if (first) parts.push(slugify(first));
  } else if (scope) {
    parts.push(slugify(scope));
  }

  if (title) parts.push(slugify(title));

  return parts.filter(Boolean).join('.');
}
