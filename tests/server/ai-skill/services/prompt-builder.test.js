'use strict';

const {
  buildPrompt,
  parseJsonFromLLM,
} = require('../../../../packages/server/ai-skill/services/prompt-builder.service');

describe('buildPrompt', () => {
  const version = {
    systemPrompt: 'You are helpful.',
    skillBody: 'Reformulate the user text.',
    inputTemplate: '<x>{{input.prompt}}</x>',
  };

  it('produces a system + user pair with the input wrapped in random XML tags', () => {
    const { messages, suffix } = buildPrompt({
      version,
      input: { prompt: 'hello' },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('You are helpful.');
    expect(messages[0].content).toContain('Reformulate the user text.');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain(`<user_input_${suffix}>`);
    expect(messages[1].content).toContain('<x>hello</x>');
    expect(messages[1].content).toContain(`</user_input_${suffix}>`);
  });

  it('uses a deterministic suffix when provided (test seam)', () => {
    const { messages } = buildPrompt({
      version,
      input: { prompt: 'x' },
      suffix: 'abcd1234',
    });
    expect(messages[1].content).toContain('<user_input_abcd1234>');
  });

  it('produces a different suffix on each call by default', () => {
    const a = buildPrompt({ version, input: { prompt: 'x' } }).suffix;
    const b = buildPrompt({ version, input: { prompt: 'x' } }).suffix;
    expect(a).not.toBe(b);
  });

  it('resolves dot-paths in placeholders', () => {
    const v = { ...version, inputTemplate: '{{input.deep.value}}' };
    const { messages } = buildPrompt({
      version: v,
      input: { deep: { value: 'X' } },
    });
    expect(messages[1].content).toContain('X');
  });

  it('replaces missing values with empty string', () => {
    const { messages } = buildPrompt({
      version,
      input: {},
      suffix: 's',
    });
    expect(messages[1].content).toContain('<x></x>');
  });

  it('appends the output contract to the STATIC section, before the user input', () => {
    const { messages } = buildPrompt({
      version,
      input: { x: 'val' },
      suffix: 's',
      outputContract: '## Format de sortie (obligatoire)\n{"text": "..."}',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('## Format de sortie (obligatoire)');
    // Static section only — never inside the delimited user input.
    expect(messages[1].content).not.toContain('Format de sortie');
    // After the skillBody (end of static section).
    const sys = messages[0].content;
    expect(sys.indexOf('Format de sortie')).toBeGreaterThan(
      sys.indexOf(version.skillBody)
    );
  });

  it('creates a system message for the contract even without systemPrompt/skillBody', () => {
    const { messages } = buildPrompt({
      version: { systemPrompt: '', skillBody: '', inputTemplate: 'x' },
      input: {},
      suffix: 's',
      outputContract: 'CONTRAT',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: 'CONTRAT' });
  });

  it('keeps the previous behaviour when no contract is provided', () => {
    const { messages } = buildPrompt({ version, input: {}, suffix: 's' });
    expect(messages[0].content).not.toContain('Format de sortie');
  });

  it('serializes object/array values as JSON (never "[object Object]")', () => {
    const v = { ...version, inputTemplate: '{{input.expertise}}' };
    const expertise = [
      { expertiseId: 'redaction.cta.principes', title: 'CTA', body: 'Règles…' },
    ];
    const { messages } = buildPrompt({
      version: v,
      input: { expertise },
      suffix: 's',
    });
    expect(messages[1].content).not.toContain('[object Object]');
    expect(messages[1].content).toContain(
      '"expertiseId": "redaction.cta.principes"'
    );
    expect(messages[1].content).toContain('"body": "Règles…"');
  });

  it('omits the system message when both systemPrompt and skillBody are empty', () => {
    const { messages } = buildPrompt({
      version: { systemPrompt: '', skillBody: '', inputTemplate: 'x' },
      input: {},
      suffix: 's',
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
  });
});

describe('parseJsonFromLLM', () => {
  it('parses plain JSON', () => {
    expect(parseJsonFromLLM('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    expect(parseJsonFromLLM('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips bare ``` fences', () => {
    expect(parseJsonFromLLM('```\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });

  it('falls back to the first JSON-looking block', () => {
    expect(parseJsonFromLLM('chatter before {"a":1} chatter after')).toEqual({
      a: 1,
    });
  });

  it('throws on empty input', () => {
    expect(() => parseJsonFromLLM('')).toThrow();
    expect(() => parseJsonFromLLM(null)).toThrow();
  });

  it('throws when no JSON found', () => {
    expect(() => parseJsonFromLLM('plain text no json')).toThrow();
  });

  it('repairs RAW newlines inside a JSON string (Mistral long-Markdown failure)', () => {
    // Exact real-world pattern: properly escaped \n for most of the string,
    // then a switch to raw newlines mid-string.
    const raw =
      '```json\n{\n  "text": "# Rapport\\n\\n## Critère 1\\nok.\n2. **Suite** : brut.\nFin."\n}\n```';
    const parsed = parseJsonFromLLM(raw);
    expect(parsed.text).toContain('# Rapport');
    expect(parsed.text).toContain('2. **Suite** : brut.');
    expect(parsed.text).toContain('Fin.');
  });

  it('repairs raw tabs and carriage returns inside strings', () => {
    const parsed = parseJsonFromLLM('{"a": "x\ty\r\nz"}');
    expect(parsed.a).toBe('x\ty\r\nz');
  });

  it('does not alter control characters outside string literals', () => {
    expect(parseJsonFromLLM('{\n  "a": 1\n}')).toEqual({ a: 1 });
  });

  it('repairs strings with escaped quotes followed by raw newlines', () => {
    const parsed = parseJsonFromLLM('{"a": "dit \\"oui\\" puis\nla suite"}');
    expect(parsed.a).toBe('dit "oui" puis\nla suite');
  });
});
