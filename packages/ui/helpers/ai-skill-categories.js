// Canonical skill / expertise categories. Mirrors the server enum
// `SkillCategories` (packages/server/ai-skill/constant/skill-constants.js):
// values are stored RAW, only the display is translated via
// aiSkills.categories.*. Adding a category means touching three places — the
// server enum, this list, and the locales — so keep them in this order.
export const SKILL_CATEGORIES = [
  'redaction',
  'qc',
  'design',
  'html_integration',
  'deliverability',
  'translation',
  'other',
];

// Items for a category select. `vm` is the component instance (for $t).
export function skillCategoryOptions(vm) {
  return SKILL_CATEGORIES.map((value) => ({
    value,
    text: vm.$t(`aiSkills.categories.${value}`),
  }));
}

// Translated label for a single category, or '' when unset.
export function skillCategoryLabel(vm, value) {
  return value ? vm.$t(`aiSkills.categories.${value}`) : '';
}
