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

// Who may read a skill or an expertise outside the back office (ADR 0013).
// Mirrors the server enum `Audiences`; the platform group comes first, as the
// default of a new one.
export const SKILL_AUDIENCES = ['platform', 'subscribers'];

// Items for an audience select. `vm` is the component instance (for $t).
export function audienceOptions(vm) {
  return SKILL_AUDIENCES.map((value) => ({
    value,
    text: vm.$t(`aiSkills.audiences.${value}`),
  }));
}
