'use strict';

const {
  buildOutputContract,
} = require('../../../../packages/server/ai-skill/schemas/output-contract.js');

describe('buildOutputContract', () => {
  it('derives the JSON contract block from genericTextOutput', () => {
    const block = buildOutputContract('genericTextOutput');
    expect(block).toContain('## Format de sortie (obligatoire)');
    expect(block).toContain('UNIQUEMENT avec un objet JSON valide');
    // The JSON Schema derived from the zod schema, $schema noise stripped.
    expect(block).toContain('"text"');
    expect(block).toContain('"required"');
    expect(block).toContain('"additionalProperties": false');
    expect(block).not.toContain('$schema');
    expect(block).toContain('Ne pose jamais de question en retour');
  });

  it('returns null for an unknown or absent schemaId (no injection, no crash)', () => {
    expect(buildOutputContract('nope')).toBeNull();
    expect(buildOutputContract(null)).toBeNull();
    expect(buildOutputContract(undefined)).toBeNull();
  });
});
