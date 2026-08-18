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

// Options for a fixed <select> of the canonical types (value kept raw).
export function emailTypeOptions(vm) {
  return EMAIL_TYPES.map((value) => ({
    value,
    text: emailTypeLabel(vm, value),
  }));
}
