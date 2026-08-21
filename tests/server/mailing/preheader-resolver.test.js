'use strict';

// The preheader is stored in the template's own `preheaderText` property, whose
// LOCATION differs between client templates: at the root of `data` for Badsender
// News / Challenges confidentiel / Badsender and comments, inside
// `data.preheaderBlock` for Clarins ×2 / Shine / Ouest France.
//
// Getting this wrong is silent: writing at the root of a Clarins email stores a
// value the sent email never uses, and the editor's "Template Options" panel keeps
// showing the old one. These tests pin both locations and the refusal to invent
// the property on a template that never declared it.

const {
  readPreheader,
  writePreheader,
  findPreheaderLocation,
} = require('../../../packages/server/mailing/preheader-resolver.js');

const rootTemplate = () => ({ preheaderText: 'root value', other: 1 });
const blockTemplate = () => ({
  preheaderBlock: { preheaderText: 'block value', color: '#fff' },
  other: 1,
});

describe('findPreheaderLocation', () => {
  it('detects the root location', () => {
    expect(findPreheaderLocation(rootTemplate())).toBe('root');
  });

  it('detects the block location', () => {
    expect(findPreheaderLocation(blockTemplate())).toBe('block');
  });

  it('returns null when the template declares no preheader', () => {
    expect(findPreheaderLocation({ titleBlock: {} })).toBeNull();
  });

  it('prefers the root when both exist, so a single value wins', () => {
    expect(
      findPreheaderLocation({
        preheaderText: 'a',
        preheaderBlock: { preheaderText: 'b' },
      })
    ).toBe('root');
  });

  it.each([[null], [undefined], ['a string'], [42], [[]]])(
    'returns null on malformed data (%p)',
    (data) => {
      expect(findPreheaderLocation(data)).toBeNull();
    }
  );
});

describe('readPreheader', () => {
  it('reads at the root', () => {
    expect(readPreheader(rootTemplate())).toBe('root value');
  });

  it('reads inside the block', () => {
    expect(readPreheader(blockTemplate())).toBe('block value');
  });

  it('returns null when the template has no preheader', () => {
    expect(readPreheader({ titleBlock: {} })).toBeNull();
  });

  it('returns null rather than a non-string value', () => {
    expect(readPreheader({ preheaderText: { nested: true } })).toBeNull();
    expect(readPreheader({ preheaderBlock: { preheaderText: 12 } })).toBeNull();
  });

  it('returns the empty string as-is, distinct from "no preheader"', () => {
    expect(readPreheader({ preheaderText: '' })).toBe('');
  });

  it.each([[null], [undefined]])('survives malformed data (%p)', (data) => {
    expect(readPreheader(data)).toBeNull();
  });
});

describe('writePreheader', () => {
  it('writes at the root and reports the location', () => {
    const data = rootTemplate();
    const result = writePreheader(data, 'new value');

    expect(result.written).toBe(true);
    expect(result.location).toBe('root');
    expect(data.preheaderText).toBe('new value');
    // Nothing else touched, and no phantom copy created in a block.
    expect(data.other).toBe(1);
    expect(data.preheaderBlock).toBeUndefined();
  });

  it('writes inside the block and reports the location', () => {
    const data = blockTemplate();
    const result = writePreheader(data, 'new value');

    expect(result.written).toBe(true);
    expect(result.location).toBe('block');
    expect(data.preheaderBlock.preheaderText).toBe('new value');
    expect(data.preheaderBlock.color).toBe('#fff');
    // The root must stay clean: a second copy would compete with the real one.
    expect(data).not.toHaveProperty('preheaderText');
  });

  it('creates nothing on a template without a preheader', () => {
    const data = { titleBlock: { text: 'hi' } };
    const result = writePreheader(data, 'new value');

    expect(result.written).toBe(false);
    expect(result.location).toBeNull();
    expect(data).toEqual({ titleBlock: { text: 'hi' } });
  });

  it('clears the value with an empty string', () => {
    const data = rootTemplate();
    writePreheader(data, '');
    expect(data.preheaderText).toBe('');
  });

  it.each([[null], [undefined], [42]])(
    'coerces a non-string value (%p) to an empty string rather than storing it',
    (value) => {
      const data = blockTemplate();
      writePreheader(data, value);
      expect(data.preheaderBlock.preheaderText).toBe('');
    }
  );

  it('mutates in place, since the caller must markModified the Mixed field', () => {
    const data = rootTemplate();
    const result = writePreheader(data, 'x');
    expect(result.data).toBe(data);
  });

  it.each([[null], [undefined]])('survives malformed data (%p)', (data) => {
    expect(writePreheader(data, 'x')).toEqual({
      data,
      written: false,
      location: null,
    });
  });
});
