'use strict';

const {
  validateTemplateCoherence,
  templateWarnings,
  WarningCodes,
} = require('../../../../packages/server/ai-skill/services/template-coherence.js');

// Real v1.1 content of redaction.cta.promo (sanitized during the smoke
// campaign debug) — non-regression: this template MUST pass validation.
const V11_TEMPLATE = `Voici les éléments à prendre en compte pour générer les CTAs.

<expertise>
{{input.expertise}}
</expertise>

<brief>
{{input.prompt}}
</brief>

<contexte_additionnel>
{{input.context}}
</contexte_additionnel>

Génère maintenant les 3 propositions selon le processus défini.`;

describe('validateTemplateCoherence', () => {
  it('flags out-of-schema placeholders (the original v1.0 bug)', () => {
    const template = '<brief>{{input.brief}}</brief><u>{{input.userInput}}</u>';
    const { unknownFields } = validateTemplateCoherence(
      template,
      'genericTextInput'
    );
    expect(unknownFields).toEqual(
      expect.arrayContaining(['brief', 'userInput'])
    );
  });

  it('accepts the sanitized v1.1 template (non-regression on real content)', () => {
    const result = validateTemplateCoherence(V11_TEMPLATE, 'genericTextInput');
    expect(result.unknownFields).toEqual([]);
    expect(result.missingRequired).toEqual([]);
  });

  it('treats {{input.expertise}} as valid iff the schema accepts it', () => {
    const ok = validateTemplateCoherence(
      '{{input.expertise}} {{input.prompt}}',
      'genericTextInput'
    );
    expect(ok.unknownFields).toEqual([]);
    // genericTextOutput has no expertise field → out of schema.
    const ko = validateTemplateCoherence(
      '{{input.expertise}}',
      'genericTextOutput'
    );
    expect(ko.unknownFields).toEqual(['expertise']);
  });

  it('reports required schema fields not referenced in the template', () => {
    const { missingRequired, unknownFields } = validateTemplateCoherence(
      '{{input.context}}',
      'genericTextInput'
    );
    expect(missingRequired).toEqual(['prompt']);
    expect(unknownFields).toEqual([]);
  });

  it('validates nested paths on their first segment only (v1)', () => {
    const { unknownFields } = validateTemplateCoherence(
      '{{input.prompt.deep.path}}',
      'genericTextInput'
    );
    expect(unknownFields).toEqual([]);
  });

  it('returns empty lists for an unknown schemaId (nothing to validate)', () => {
    expect(validateTemplateCoherence('{{input.x}}', 'nope')).toEqual({
      unknownFields: [],
      missingRequired: [],
      missingExpertise: false,
    });
  });

  it('flags an expertise-capable schema whose template omits {{input.expertise}}', () => {
    const { missingExpertise } = validateTemplateCoherence(
      '{{input.prompt}} {{input.context}}',
      'genericTextInput'
    );
    expect(missingExpertise).toBe(true);
  });

  it('does not flag missingExpertise when the template inserts it', () => {
    const { missingExpertise } = validateTemplateCoherence(
      V11_TEMPLATE,
      'genericTextInput'
    );
    expect(missingExpertise).toBe(false);
  });

  it('does not flag missingExpertise when the schema has no expertise field', () => {
    const { missingExpertise } = validateTemplateCoherence(
      '{{input.text}}',
      'genericTextOutput'
    );
    expect(missingExpertise).toBe(false);
  });
});

describe('templateWarnings', () => {
  // Codes plus interpolation data, not sentences: the wording lives in the UI
  // locales so it exists in fr and en.
  it('reports every issue kind as a code carrying what the sentence needs', () => {
    // References only {{input.brief}}: unknown field + missing required prompt
    // + missing expertise (genericTextInput accepts expertises).
    const warnings = templateWarnings('{{input.brief}}', 'genericTextInput');
    expect(warnings).toEqual([
      {
        code: WarningCodes.UNKNOWN_FIELDS,
        schemaId: 'genericTextInput',
        fields: ['brief'],
      },
      {
        code: WarningCodes.MISSING_REQUIRED,
        schemaId: 'genericTextInput',
        fields: ['prompt'],
      },
      { code: WarningCodes.MISSING_EXPERTISE },
    ]);
  });

  it('warns when an expertise-capable schema omits {{input.expertise}}', () => {
    const warnings = templateWarnings(
      '{{input.prompt}} {{input.context}}',
      'genericTextInput'
    );
    expect(warnings).toEqual([{ code: WarningCodes.MISSING_EXPERTISE }]);
  });

  it('carries no French: every warning is an identifier', () => {
    for (const w of templateWarnings('{{input.brief}}', 'genericTextInput')) {
      expect(w.code).toMatch(/^[A-Z_]+$/);
    }
  });

  it('returns no warning for a coherent template', () => {
    expect(templateWarnings(V11_TEMPLATE, 'genericTextInput')).toEqual([]);
  });
});
