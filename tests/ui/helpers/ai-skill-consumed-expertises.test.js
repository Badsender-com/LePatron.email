'use strict';

// The expertises a task skill's version consumes, as the version editor
// lists them: in order, each with its title and what keeps it from an
// assistant (not found, not published, kept to the platform company), and
// never one twice nor more than the server takes.

const {
  MAX_CONSUMED_EXPERTISES,
  SEARCH_RESULTS,
  CONSUMED_STATES,
  consumedRows,
  idsToRead,
  searchParams,
  withRead,
  addableExpertises,
  withConsumed,
  moveConsumed,
} = require('../../../packages/ui/helpers/ai-skill-consumed-expertises');
const {
  MaxConsumedExpertises,
} = require('../../../packages/server/ai-skill/constant/skill-constants');
const {
  MAX_SEARCH_LENGTH,
} = require('../../../packages/server/ai-skill/services/expertise-list-filter');

const published = (expertiseId, title, fields = {}) => ({
  expertiseId,
  title,
  status: 'ACTIVE',
  activeVersion: { major: 1, minor: 0 },
  audience: 'all',
  ...fields,
});
const EXPERTISES = [
  published('brand.tone', 'Brand tone'),
  published('qc.deliverability', 'Deliverability'),
  published('qc.subject-line', 'Subject line'),
  published('qc.draft', 'A draft', {
    status: 'DRAFT',
    activeVersion: { major: null, minor: 0 },
  }),
  published('qc.archived', 'Archived', { status: 'ARCHIVED' }),
  published('qc.proving', 'Still proven', { audience: 'platform' }),
];

describe('consumedRows', () => {
  it('lists the consumed expertises in their order, with their titles', () => {
    expect(
      consumedRows(['qc.subject-line', 'brand.tone'], EXPERTISES, [
        'qc.subject-line',
        'brand.tone',
      ])
    ).toEqual([
      { id: 'qc.subject-line', title: 'Subject line', state: null },
      { id: 'brand.tone', title: 'Brand tone', state: null },
    ]);
  });

  it.each([
    ['not found', 'qc.never-was', null, CONSUMED_STATES.NOT_FOUND],
    ['a draft', 'qc.draft', 'A draft', CONSUMED_STATES.NOT_PUBLISHED],
    ['archived', 'qc.archived', 'Archived', CONSUMED_STATES.NOT_PUBLISHED],
    [
      'kept to the platform company',
      'qc.proving',
      'Still proven',
      CONSUMED_STATES.PLATFORM_ONLY,
    ],
  ])(
    'says of one %s what keeps it from an assistant',
    (_case, id, title, state) => {
      expect(consumedRows([id], EXPERTISES, [id])).toEqual([
        { id, title, state },
      ]);
    }
  );

  it('says not found only of an id the server was asked for', () => {
    expect(
      consumedRows(['qc.never-was', 'qc.not-read-yet'], [], ['qc.never-was'])
    ).toEqual([
      { id: 'qc.never-was', title: null, state: CONSUMED_STATES.NOT_FOUND },
      { id: 'qc.not-read-yet', title: null, state: null },
    ]);
  });

  it('flags nothing missing while nothing is read, or reading failed', () => {
    expect(consumedRows(['qc.never-was'], [], [])).toEqual([
      { id: 'qc.never-was', title: null, state: null },
    ]);
  });

  it('answers no row for no id', () => {
    expect(consumedRows(undefined, EXPERTISES, [])).toEqual([]);
  });
});

describe('idsToRead', () => {
  it('asks the server for the ids not asked for yet, each once', () => {
    expect(idsToRead(['a', 'b', 'c', 'b'], ['b'])).toEqual(['a', 'c']);
  });

  it('asks for nothing when every id is read', () => {
    expect(idsToRead(['a'], ['a'])).toEqual([]);
    expect(idsToRead(undefined, [])).toEqual([]);
  });

  it('asks for no more than the server reads at once', () => {
    const ids = Array.from(
      { length: MAX_CONSUMED_EXPERTISES + 5 },
      (_, i) => `e${i}`
    );

    expect(idsToRead(ids, [])).toHaveLength(MAX_CONSUMED_EXPERTISES);
  });
});

describe('searchParams', () => {
  it('searches the published expertises, a few of them', () => {
    expect(searchParams('  CTA ')).toEqual({
      status: 'ACTIVE',
      pageSize: SEARCH_RESULTS,
      search: 'CTA',
    });
    expect(SEARCH_RESULTS).toBeLessThanOrEqual(20);
  });

  it('lists the first published ones before anything is typed', () => {
    expect(searchParams(null)).toEqual({
      status: 'ACTIVE',
      pageSize: SEARCH_RESULTS,
    });
    expect(searchParams('   ')).not.toHaveProperty('search');
  });

  it('never sends a search longer than the server takes', () => {
    expect(searchParams('a'.repeat(500)).search).toHaveLength(
      MAX_SEARCH_LENGTH
    );
  });
});

describe('withRead', () => {
  it('keeps each expertise once, the latest read', () => {
    const known = [published('a', 'Old A'), published('b', 'B')];

    expect(withRead(known, [published('a', 'New A')])).toEqual([
      published('a', 'New A'),
      published('b', 'B'),
    ]);
  });
});

describe('addableExpertises', () => {
  it('offers the published expertises not consumed yet', () => {
    expect(addableExpertises(EXPERTISES, ['brand.tone'])).toEqual([
      {
        value: 'qc.deliverability',
        text: 'Deliverability (qc.deliverability)',
      },
      { value: 'qc.subject-line', text: 'Subject line (qc.subject-line)' },
      { value: 'qc.proving', text: 'Still proven (qc.proving)' },
    ]);
  });
});

describe('withConsumed', () => {
  it('adds an expertise at the end', () => {
    expect(withConsumed(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('never adds one twice', () => {
    expect(withConsumed(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('adds none past the most the server takes', () => {
    const full = Array.from(
      { length: MAX_CONSUMED_EXPERTISES },
      (_, i) => `e${i}`
    );

    expect(withConsumed(full, 'one-more')).toEqual(full);
  });

  it('adds nothing for no expertise', () => {
    expect(withConsumed(['a'], null)).toEqual(['a']);
  });
});

describe('moveConsumed', () => {
  const ids = ['a', 'b', 'c'];

  it('moves an expertise up', () => {
    expect(moveConsumed(ids, 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('moves an expertise down', () => {
    expect(moveConsumed(ids, 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it.each([
    [0, -1],
    [2, 1],
  ])('keeps the order when %i would leave the list', (index, offset) => {
    expect(moveConsumed(ids, index, offset)).toEqual(ids);
  });

  it('never changes the list it is given', () => {
    moveConsumed(ids, 0, 1);

    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

it('bounds the list as the server does', () => {
  expect(MAX_CONSUMED_EXPERTISES).toBe(MaxConsumedExpertises);
});
