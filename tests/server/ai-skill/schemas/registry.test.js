'use strict';

const {
  schemas,
  getSchema,
  listSchemaIds,
  hasSchema,
} = require('../../../../packages/server/ai-skill/schemas');

describe('zod schema registry', () => {
  it('exposes the demo schemas', () => {
    expect(hasSchema('genericTextInput')).toBe(true);
    expect(hasSchema('genericTextOutput')).toBe(true);
  });

  it('returns undefined for unknown schemaId', () => {
    expect(getSchema('does-not-exist')).toBeUndefined();
    expect(hasSchema('does-not-exist')).toBe(false);
  });

  it('lists known schemaIds', () => {
    const ids = listSchemaIds();
    expect(ids).toContain('genericTextInput');
    expect(ids).toContain('genericTextOutput');
  });

  it('genericTextInput validates a valid payload', () => {
    const result = schemas.genericTextInput.safeParse({ prompt: 'hi' });
    expect(result.success).toBe(true);
  });

  it('genericTextInput rejects missing prompt', () => {
    const result = schemas.genericTextInput.safeParse({ context: 'x' });
    expect(result.success).toBe(false);
  });

  it('genericTextOutput is strict (extra keys rejected)', () => {
    const result = schemas.genericTextOutput.safeParse({
      text: 'ok',
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('genericTextInput accepts an optional expertise array', () => {
    const result = schemas.genericTextInput.safeParse({
      prompt: 'hi',
      expertise: [
        {
          expertiseId: 'redaction.cta.principes',
          title: 'Principes CTA',
          body: 'Texte de l’expertise',
          examplesGood: ['Bon exemple'],
          examplesBad: [],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('genericTextInput still validates without expertise', () => {
    expect(schemas.genericTextInput.safeParse({ prompt: 'hi' }).success).toBe(
      true
    );
  });

  it('genericTextInput stays strict (unknown keys rejected)', () => {
    const result = schemas.genericTextInput.safeParse({
      prompt: 'hi',
      brief: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('blockTextGenInput accepts dot-notation paths as pair VALUES (BSON-safe)', () => {
    const result = schemas.blockTextGenInput.safeParse({
      instruction: 'Rédige un bloc promo vestes',
      currentContent: [
        { path: 'titleText', value: 'Section Title' },
        { path: 'longText', value: '<p>Far far away…</p>' },
        { path: 'buttonLink.text', value: 'BUTTON' },
      ],
      expertise: [{ expertiseId: 'e1', title: 'T', body: 'B' }],
    });
    expect(result.success).toBe(true);
  });

  it('blockTextGenInput rejects empty content, bad values and unknown keys', () => {
    expect(
      schemas.blockTextGenInput.safeParse({
        instruction: 'x',
        currentContent: [],
      }).success
    ).toBe(false);
    expect(
      schemas.blockTextGenInput.safeParse({
        instruction: 'x',
        currentContent: [{ path: 'titleText', value: 42 }],
      }).success
    ).toBe(false);
    expect(
      schemas.blockTextGenInput.safeParse({
        instruction: 'x',
        currentContent: [{ path: 'a', value: 'b' }],
        rogue: true,
      }).success
    ).toBe(false);
  });

  it('blockTextGenOutput is an array of {path, value} string pairs', () => {
    expect(
      schemas.blockTextGenOutput.safeParse([
        { path: 'titleText', value: 'Nouveau titre' },
        { path: 'buttonLink.text', value: 'Découvrir' },
      ]).success
    ).toBe(true);
    expect(
      schemas.blockTextGenOutput.safeParse([
        { path: 'titleText', value: { nested: 'x' } },
      ]).success
    ).toBe(false);
  });
});
