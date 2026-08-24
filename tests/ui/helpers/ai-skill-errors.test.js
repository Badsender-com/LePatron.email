'use strict';

const {
  skillErrorMessage,
  skillWarningMessage,
} = require('../../../packages/ui/helpers/ai-skill-errors');

// Stands in for the component instance: mimics vue-i18n, which echoes the key
// back when there is no entry, and interpolates {placeholders}.
const MESSAGES = {
  'aiSkills.errors.SKILL_TEMPLATE_UNKNOWN_FIELDS':
    'Champs absents du schéma « {schemaId} » : {fields}.',
  'aiSkills.warnings.TEMPLATE_MISSING_EXPERTISE':
    'Les expertises sont ignorées.',
  'aiSkills.warnings.TEMPLATE_UNKNOWN_FIELDS':
    'Absents de « {schemaId} » : {fields}.',
  'global.errors.errorOccured': 'Une erreur est survenue',
};

const vm = {
  $t(key, params = {}) {
    const template = MESSAGES[key];
    if (!template) return key;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] === undefined ? `{${name}}` : String(params[name])
    );
  },
};

function axiosError(data) {
  return { response: { data } };
}

describe('skillErrorMessage', () => {
  it('translates a known code and interpolates its data', () => {
    const message = skillErrorMessage(
      vm,
      axiosError({
        message: 'SKILL_TEMPLATE_UNKNOWN_FIELDS',
        schemaId: 'genericTextInput',
        fields: ['brief', 'tone'],
      })
    );
    expect(message).toBe(
      'Champs absents du schéma « genericTextInput » : brief, tone.'
    );
  });

  // Better a raw code than the wrong sentence: it is searchable and tells the
  // super-admin what to report.
  it('falls back to the raw code when no wording exists for it', () => {
    expect(
      skillErrorMessage(vm, axiosError({ message: 'BRAND_NEW_CODE' }))
    ).toBe('BRAND_NEW_CODE');
  });

  it('falls back to the generic message when there is nothing usable', () => {
    expect(skillErrorMessage(vm, axiosError({}))).toBe(
      'Une erreur est survenue'
    );
    expect(skillErrorMessage(vm, {})).toBe('Une erreur est survenue');
    expect(skillErrorMessage(vm, undefined)).toBe('Une erreur est survenue');
  });
});

describe('skillWarningMessage', () => {
  it('translates a warning code', () => {
    expect(
      skillWarningMessage(vm, { code: 'TEMPLATE_MISSING_EXPERTISE' })
    ).toBe('Les expertises sont ignorées.');
  });

  it('joins the field list rather than printing an array', () => {
    expect(
      skillWarningMessage(vm, {
        code: 'TEMPLATE_UNKNOWN_FIELDS',
        schemaId: 'genericTextInput',
        fields: ['brief', 'tone'],
      })
    ).toBe('Absents de « genericTextInput » : brief, tone.');
  });

  it('falls back to the code when no wording exists', () => {
    expect(skillWarningMessage(vm, { code: 'NEW_WARNING' })).toBe(
      'NEW_WARNING'
    );
  });

  // The server used to send sentences; a stale client or a cached response
  // must not render "[object Object]".
  it('passes a plain string through', () => {
    expect(skillWarningMessage(vm, 'déjà une phrase')).toBe('déjà une phrase');
  });

  it('returns an empty string for nothing', () => {
    expect(skillWarningMessage(vm, null)).toBe('');
  });
});
