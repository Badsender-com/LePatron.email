'use strict';

// The difference a draft makes with the active version (ADR 0014): a diff
// of lines, field by field and in order, bounded in size.

const {
  draftDiff,
  MAX_LINES,
} = require('../../../packages/server/mcp/mcp-draft-diff.js');

const lines = (count, prefix) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`).join('\n');

describe('the difference of a draft', () => {
  it('shows a moved line where it left and where it went', () => {
    const diff = draftDiff(
      { body: 'Intro\nFirst\nSecond\nEnd' },
      { body: 'Intro\nSecond\nFirst\nEnd' },
      ['body']
    );

    expect(diff.split('\n')).toEqual([
      '@@ body',
      '  Intro',
      '- First',
      '  Second',
      '+ First',
      '  End',
    ]);
  });

  // The order of the consumed expertises is the order a task skill reads
  // them in (ADR 0013).
  it('shows a list put in another order', () => {
    const diff = draftDiff(
      { consumedExpertiseIds: ['a.one', 'b.two'] },
      { consumedExpertiseIds: ['b.two', 'a.one'] },
      ['consumedExpertiseIds']
    );

    expect(diff).toMatch(/^@@ consumedExpertiseIds\n/);
    expect(diff).toMatch(/^- a\.one$/m);
    expect(diff).toMatch(/^\+ a\.one$/m);
  });

  it('says nothing of a field that does not change, nor of blank lines', () => {
    expect(
      draftDiff(
        { body: 'Same', procedure: 'One' },
        { body: 'Same', procedure: '\nOne\n\n' },
        ['body', 'procedure']
      )
    ).toBe('');
  });

  it('adds every line when nothing is published', () => {
    expect(draftDiff(null, { body: 'One\n\nTwo' }, ['body'])).toBe(
      '@@ body\n+ One\n+ Two'
    );
  });

  it('keeps one unchanged line around a change, and leaves the rest out', () => {
    const before = lines(10, 'line ');
    const after = before.replace('line 5', 'changed');

    expect(draftDiff({ body: before }, { body: after }, ['body'])).toBe(
      [
        '@@ body',
        '  …',
        '  line 4',
        '- line 5',
        '+ changed',
        '  line 6',
        '  …',
      ].join('\n')
    );
  });

  it(`keeps ${MAX_LINES} lines, and says how many more there are`, () => {
    const diff = draftDiff(
      { body: lines(300, 'old '), procedure: 'a' },
      { body: lines(300, 'new '), procedure: 'b' },
      ['body', 'procedure']
    );

    const shown = diff.split('\n');
    expect(shown).toHaveLength(MAX_LINES + 1);
    // 1 + 600 lines for the body, 3 for the procedure.
    expect(shown[MAX_LINES]).toBe(`… ${604 - MAX_LINES} more lines`);
  });

  it('cuts a long line', () => {
    const diff = draftDiff({ body: 'a' }, { body: 'b'.repeat(5000) }, ['body']);

    expect(diff.length).toBeLessThan(400);
    expect(diff).toMatch(/…$/);
  });

  // Four fields of 50 000 characters, every line changed: the diff of each
  // stops at its bound instead of comparing every line with every other.
  it('stays bounded when every line of large fields changes', () => {
    const big = (prefix) => lines(8000, prefix);
    const fields = ['a', 'b', 'c', 'd'];
    const diff = draftDiff(
      Object.fromEntries(fields.map((f) => [f, big(`${f}-old-`)])),
      Object.fromEntries(fields.map((f) => [f, big(`${f}-new-`)])),
      fields
    );

    expect(diff.split('\n')).toHaveLength(MAX_LINES + 1);
    expect(diff).toMatch(/… \d+ more lines$/);
  });
});
