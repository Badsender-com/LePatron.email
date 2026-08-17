import slugify from './slugify.js';

/**
 * Build a suggested dot-hierarchical identifier from the structured fields
 * of a Skill or Expertise creation form.
 *
 * Skill format:      <category>.<title>
 * Expertise format:  <category>.<scope>.<title>  (single scope only)
 *                    <category>.<title>          (0 or 2+ scopes)
 *
 * The scope segment is included ONLY when exactly one scope is selected —
 * with several scopes there is no single meaningful segment, so picking the
 * first arbitrarily is misleading (§3).
 *
 * Parts that slugify to an empty string are skipped — so an empty title
 * leaves the suggestion empty rather than producing a trailing dot.
 *
 * @param {Object} params
 * @param {string} [params.category] — DB enum value (already slug-like)
 * @param {string} [params.title]
 * @param {string|string[]} [params.scope] — optional, expertise-only.
 * @returns {string}
 */
export default function suggestIdentifier({ category, title, scope } = {}) {
  const parts = [];

  if (category) parts.push(slugify(category));

  const scopes = (Array.isArray(scope) ? scope : [scope])
    .filter((s) => !!s && String(s).trim())
    .map((s) => String(s));
  if (scopes.length === 1) parts.push(slugify(scopes[0]));

  if (title) parts.push(slugify(title));

  return parts.filter(Boolean).join('.');
}
