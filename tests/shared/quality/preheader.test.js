'use strict';

const {
  PREHEADER_PATHS,
  preheaderOf,
} = require('../../../packages/shared/quality/preheader.js');

describe('preheaderOf', () => {
  it('reads the root preheader first', () => {
    expect(
      preheaderOf({
        preheaderText: ' Root ',
        preheaderBlock: { preheaderText: 'Block' },
      })
    ).toBe('Root');
  });

  it('falls back on the preheader block', () => {
    expect(preheaderOf({ preheaderBlock: { preheaderText: 'Block' } })).toBe(
      'Block'
    );
  });

  it('gives nothing when the template turned the preheader off', () => {
    expect(
      preheaderOf({ preheaderText: 'Hidden', preheaderVisible: false })
    ).toBe('');
  });

  it('gives nothing without content or preheader', () => {
    expect(preheaderOf(null)).toBe('');
    expect(preheaderOf({ title: 'x' })).toBe('');
  });

  it('cannot be changed by a caller', () => {
    expect(Object.isFrozen(PREHEADER_PATHS)).toBe(true);
    expect(Object.isFrozen(PREHEADER_PATHS[1])).toBe(true);
  });
});
