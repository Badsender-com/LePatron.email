import { adoptionRows, gapReasonKey } from '~/helpers/template-adoption.js';

// The adoption preview of a template's emails (#1526, ADR-0024): the emails
// it would attach or cannot, never the complete ones.

const REPORT = {
  emails: [
    { id: '1', name: 'Youth newsletter', adopted: { silo: 'youth' }, gaps: [] },
    { id: '2', name: 'Already attached', adopted: {}, gaps: [] },
    {
      id: '3',
      name: 'Cookery',
      adopted: {},
      gaps: [
        {
          dimension: 'silo',
          identifier: 'cookery',
          reason: 'UNKNOWN_IDENTIFIER',
        },
      ],
    },
  ],
  counts: { attached: 1, withGaps: 1, complete: 1 },
};

describe('the rows of the adoption preview', () => {
  it('lists the emails with a gap first, and leaves the complete ones out', () => {
    expect(adoptionRows(REPORT).map((row) => row.name)).toEqual([
      'Cookery',
      'Youth newsletter',
    ]);
  });

  it('gives each adopted value its dimension and identifier', () => {
    expect(adoptionRows(REPORT)[1].adopted).toEqual([
      { dimension: 'silo', identifier: 'youth' },
    ]);
  });

  it('has no row before a preview', () => {
    expect(adoptionRows(null)).toEqual([]);
  });

  it('explains each reason a value cannot be taken', () => {
    expect(gapReasonKey('UNKNOWN_IDENTIFIER')).toBe(
      'templates.adoption.unknownIdentifier'
    );
    expect(gapReasonKey('NOT_OFFERED')).toBe('templates.adoption.notOffered');
  });
});
