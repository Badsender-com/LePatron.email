'use strict';

const {
  toModelId,
  isValidModelId,
} = require('../../../packages/ui/helpers/ai-model-picker');

describe('toModelId', () => {
  // The regression this guards against: v-combobox, unlike v-select, ignores
  // `item-value` and emits the whole item on selection. The object went
  // through untouched, was persisted, and reached the server as
  // "[object Object]" — which its format guard rejected, so the save failed
  // and the tab reset the field to the provider default. From the outside
  // that read as "picking a model does nothing".
  it('takes the id out of a selected item', () => {
    expect(toModelId({ value: 'gpt-4o', text: 'GPT-4o (équilibré)' })).toBe(
      'gpt-4o'
    );
  });

  it('accepts an item keyed by id instead of value', () => {
    expect(toModelId({ id: 'claude-x' })).toBe('claude-x');
  });

  it('keeps a hand-typed identifier as is', () => {
    expect(toModelId('gpt-5-preview')).toBe('gpt-5-preview');
  });

  it('trims surrounding whitespace', () => {
    expect(toModelId('  gpt-4o  ')).toBe('gpt-4o');
  });

  // Empty means "provider default". '' is neither undefined nor null, so if it
  // reached the database it would win over the default in the server-side
  // resolver and be sent to the provider as the group's chosen model.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['whitespace only', '   '],
    ['an item with no id', {}],
  ])('maps %s to null', (_label, input) => {
    expect(toModelId(input)).toBeNull();
  });
});

describe('isValidModelId', () => {
  it.each([
    'gpt-4o-mini',
    'mistral-large-latest',
    'claude-opus-4-20250514',
    'gemini-2.0-flash',
    // Real identifiers use these separators.
    'accounts/fireworks/models/llama-v3',
    'mistral:7b',
  ])('accepts %s', (id) => {
    expect(isValidModelId(id)).toBe(true);
  });

  it.each([
    ['a space', 'gpt 4o'],
    ['a newline', 'gpt-4o\ninjected: true'],
    ['quotes', '"gpt-4o"'],
    ['a leading dash', '-gpt-4o'],
    ['over 128 chars', 'x'.repeat(129)],
    // What the bug used to persist.
    ['a stringified object', '[object Object]'],
  ])('rejects %s', (_label, id) => {
    expect(isValidModelId(id)).toBe(false);
  });

  // Empty is the "use the provider default" case, not an invalid entry.
  it.each([null, ''])('treats %j as valid (means default)', (id) => {
    expect(isValidModelId(id)).toBe(true);
  });
});
