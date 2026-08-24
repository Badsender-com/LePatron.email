'use strict';

const {
  SKILL_CATEGORIES,
  skillCategoryOptions,
  skillCategoryLabel,
} = require('../../../packages/ui/helpers/ai-skill-categories');
const {
  SkillCategoryValues,
} = require('../../../packages/server/ai-skill/constant/skill-constants');

const vm = { $t: (key) => `t(${key})` };

// The list was copied by hand into six components; folding it into one helper
// only helps if the copy stays in step with the enum the server validates
// against. This test is that guarantee.
describe('SKILL_CATEGORIES', () => {
  it('matches the server enum, in the same order', () => {
    expect(SKILL_CATEGORIES).toEqual(SkillCategoryValues);
  });
});

describe('skillCategoryOptions', () => {
  it('builds one translated option per category', () => {
    const options = skillCategoryOptions(vm);
    expect(options).toHaveLength(SKILL_CATEGORIES.length);
    expect(options[0]).toEqual({
      value: 'redaction',
      text: 't(aiSkills.categories.redaction)',
    });
  });
});

describe('skillCategoryLabel', () => {
  it('translates a category and answers empty for none', () => {
    expect(skillCategoryLabel(vm, 'qc')).toBe('t(aiSkills.categories.qc)');
    expect(skillCategoryLabel(vm, null)).toBe('');
    expect(skillCategoryLabel(vm, '')).toBe('');
  });
});
