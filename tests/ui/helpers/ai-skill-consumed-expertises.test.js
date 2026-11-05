'use strict';

// The expertises a task skill's version consumes, as the version editor
// lists them: in order, each with its title, flagged when the editor cannot
// find it (archived, or past the expertises it reads), and never more than
// the server takes.

const {
  MAX_CONSUMED_EXPERTISES,
  consumedRows,
  addableExpertises,
  moveConsumed,
} = require('../../../packages/ui/helpers/ai-skill-consumed-expertises');
const {
  MaxConsumedExpertises,
} = require('../../../packages/server/ai-skill/constant/skill-constants');

const EXPERTISES = [
  { expertiseId: 'brand.tone', title: 'Brand tone' },
  { expertiseId: 'qc.deliverability', title: 'Deliverability' },
  { expertiseId: 'qc.subject-line', title: 'Subject line' },
];

describe('consumedRows', () => {
  it('lists the consumed expertises in their order, with their titles', () => {
    expect(
      consumedRows(['qc.subject-line', 'brand.tone'], EXPERTISES, true)
    ).toEqual([
      { id: 'qc.subject-line', title: 'Subject line', missing: false },
      { id: 'brand.tone', title: 'Brand tone', missing: false },
    ]);
  });

  it('keeps an id the editor cannot find, flagged as missing', () => {
    expect(
      consumedRows(['brand.tone', 'qc.archived'], EXPERTISES, true)
    ).toEqual([
      { id: 'brand.tone', title: 'Brand tone', missing: false },
      { id: 'qc.archived', title: null, missing: true },
    ]);
  });

  it('flags nothing while the expertises are not read, or failed to be', () => {
    expect(consumedRows(['qc.archived'], [], false)).toEqual([
      { id: 'qc.archived', title: null, missing: false },
    ]);
  });

  it('answers no row for no id', () => {
    expect(consumedRows(undefined, EXPERTISES, true)).toEqual([]);
  });
});

describe('addableExpertises', () => {
  it('offers the expertises not consumed yet', () => {
    expect(addableExpertises(EXPERTISES, ['brand.tone'])).toEqual([
      {
        value: 'qc.deliverability',
        text: 'Deliverability (qc.deliverability)',
      },
      { value: 'qc.subject-line', text: 'Subject line (qc.subject-line)' },
    ]);
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
