import {
  AUDIENCES,
  AUDIENCE_VALUES,
  SKILL_NATURES,
  SKILL_NATURE_VALUES,
} from '../../shared/ai-skill/constants.js';

// The audiences and natures, read from packages/shared with the server.
export { AUDIENCES, SKILL_NATURES, SKILL_NATURE_VALUES };

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

// Who may use a skill or an expertise (ADR 0013); the platform company comes
// first, as the default of a new one.
export const SKILL_AUDIENCES = AUDIENCE_VALUES;

// What the audience means depends on the item: an expertise is read in the
// editor and by assistants, a feature skill runs a button of the editor and
// may be offered to assistants, a task skill only reaches assistants.
export const AUDIENCE_ITEM_KINDS = Object.freeze({
  EXPERTISE: 'expertise',
  FEATURE_SKILL: 'featureSkill',
  TASK_SKILL: 'taskSkill',
});

// Items for an audience select. `vm` is the component instance (for $t),
// `kind` one of AUDIENCE_ITEM_KINDS.
export function audienceOptions(vm, kind) {
  return SKILL_AUDIENCES.map((value) => ({
    value,
    text: vm.$t(`aiSkills.audiences.${kind}.${value}`),
  }));
}
