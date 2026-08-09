// ISO 639-1 language options for expertise "applies to languages".
// Labels shown as "fr — Français". Kept to the languages LePatron realistically
// authors in; extend as needed.
export const ISO_LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pt', label: 'Português' },
];

export function isoLanguageOptions() {
  return ISO_LANGUAGES.map((l) => ({
    value: l.code,
    text: `${l.code} — ${l.label}`,
  }));
}
