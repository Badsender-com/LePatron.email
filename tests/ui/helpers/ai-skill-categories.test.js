'use strict';

const {
  SKILL_CATEGORIES,
  SKILL_AUDIENCES,
  SKILL_NATURE_VALUES,
  AUDIENCE_ITEM_KINDS,
  skillCategoryOptions,
  skillCategoryLabel,
  audienceOptions,
} = require('../../../packages/ui/helpers/ai-skill-categories');
const {
  SkillCategoryValues,
  AudienceValues,
  SkillNatureValues,
} = require('../../../packages/server/ai-skill/constant/skill-constants');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

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

// Read from packages/shared by both sides, never copied (ADR 0013).
describe('the natures of a skill', () => {
  it('are the server ones, in the same order', () => {
    expect(SKILL_NATURE_VALUES).toEqual(SkillNatureValues);
  });
});

// The audience reads differently on an expertise, a feature skill and a task
// skill (ADR 0013), in both languages, and never names a brand nor a "group".
describe('audienceOptions', () => {
  it('matches the server enum, in the same order', () => {
    expect(SKILL_AUDIENCES).toEqual(AudienceValues);
  });

  it.each(Object.values(AUDIENCE_ITEM_KINDS))(
    'words the audience of a %s for that item',
    (kind) => {
      expect(audienceOptions(vm, kind)).toEqual([
        { value: 'platform', text: `t(aiSkills.audiences.${kind}.platform)` },
        { value: 'all', text: `t(aiSkills.audiences.${kind}.all)` },
      ]);
    }
  );

  it.each([
    ['fr', fr],
    ['en', en],
  ])('has every label in %s', (_lang, messages) => {
    const { aiSkills } = messages;
    const labels = [
      ...Object.values(AUDIENCE_ITEM_KINDS).flatMap((kind) =>
        SKILL_AUDIENCES.map((value) => aiSkills.audiences[kind][value])
      ),
      aiSkills.audienceHint,
      aiSkills.platformOnly,
      aiSkills.version.platformOnlyReminder,
      aiSkills.version.openToAll,
    ];

    labels.forEach((label) => {
      expect(typeof label).toBe('string');
      expect(label).not.toMatch(/badsender|group/i);
    });
  });
});
