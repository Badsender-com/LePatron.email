'use strict';

const runOutputAsMarkdown = require('../../../packages/ui/helpers/run-output-markdown')
  .default;

// The skill output convention, in one place instead of three components.

describe('runOutputAsMarkdown', () => {
  it('has nothing to show for a missing output', () => {
    expect(runOutputAsMarkdown(null)).toBe('');
    expect(runOutputAsMarkdown(undefined)).toBe('');
  });

  it('passes a plain string through', () => {
    expect(runOutputAsMarkdown('# Title')).toBe('# Title');
  });

  it('prefers `text`, then `markdown`', () => {
    expect(runOutputAsMarkdown({ text: 'the answer' })).toBe('the answer');
    expect(runOutputAsMarkdown({ markdown: '**bold**' })).toBe('**bold**');
    expect(runOutputAsMarkdown({ text: 'first', markdown: 'second' })).toBe(
      'first'
    );
  });

  it('ignores a `text` that is not a string', () => {
    const out = runOutputAsMarkdown({ text: { nested: true }, other: 1 });
    expect(out).toContain('```json');
    expect(out).toContain('"nested": true');
  });

  it('shows the structure when there is no conventional text field', () => {
    expect(runOutputAsMarkdown({ score: 8, issues: ['a'] })).toBe(
      '```json\n{\n  "score": 8,\n  "issues": [\n    "a"\n  ]\n}\n```'
    );
  });

  it('keeps an empty string as empty rather than dumping JSON', () => {
    expect(runOutputAsMarkdown({ text: '' })).toBe('');
  });
});
