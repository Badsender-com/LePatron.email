// Canonical email types. Values are stored RAW (promo/newsletter/transactional);
// only the display is translated via aiSkills.emailTypes.*. Free/unknown values
// (facet inputs allow custom entries) fall back to their raw string.
export const EMAIL_TYPES = ['promo', 'newsletter', 'transactional'];

// `vm` is the component instance (for $t). Returns the translated label for a
// known type, or the raw value otherwise.
export function emailTypeLabel(vm, value) {
  if (!value) return '';
  const key = `aiSkills.emailTypes.${value}`;
  const label = vm.$t(key);
  return label === key ? value : label;
}

// Items for an email-type facet combobox: the canonical types first, then any
// extra value already present in database. Facets alone are not enough — they
// are a `distinct` over existing expertises, so on a fresh base the selector
// would offer nothing and the first expertise would have to be tagged blind.
// Values stay raw; the display is translated by emailTypeLabel.
export function emailTypeItems(facets = []) {
  const extras = facets.filter(
    (value) => value && !EMAIL_TYPES.includes(value)
  );
  return [...EMAIL_TYPES, ...[...new Set(extras)].sort()];
}

// Items for an email-type SELECT ({ value, text }), as opposed to the raw
// strings emailTypeItems returns for a combobox. Same source, translated
// labels.
export function emailTypeOptions(vm, facets = []) {
  return emailTypeItems(facets).map((value) => ({
    value,
    text: emailTypeLabel(vm, value),
  }));
}
