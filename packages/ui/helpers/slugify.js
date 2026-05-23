/**
 * Slugify a free-text string into a kebab-case slug suitable for use inside
 * a dot-hierarchical identifier (e.g. `redaction.cta.principes-generaux`).
 *
 * Rules:
 *   - Unicode NFD normalisation + diacritic stripping (é → e, à → a, …)
 *   - Lowercase
 *   - Any non-alphanumeric run becomes a single `-`
 *   - No leading/trailing `-`
 *   - Capped at 50 characters
 *
 * Empty / nullish input returns the empty string.
 */
export default function slugify(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
