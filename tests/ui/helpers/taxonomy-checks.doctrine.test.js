'use strict';

// The points to check an email type adds (epic #1631, ADR-0030): an email type
// mapped onto no doctrine type, and a template comparing `doctrineType` with a
// literal outside the six types of the doctrine. Shown, never blocking.

const DIMENSIONS = [
  { name: 'emailType', standard: true, isActive: true },
  { name: 'trigger', standard: true, isActive: true },
];

const emailType = (id, extra = {}) => ({
  id,
  type: 'emailType',
  label: id,
  canonicalType: id,
  isActive: true,
  ...extra,
});

const check = ({ values, templates = [] }) => {
  const { pointsToCheck } = require('~/helpers/taxonomy-checks.js');
  return pointsToCheck({ dimensions: DIMENSIONS, values, templates });
};

// Turned on by #1637 (an email type mapped onto no doctrine type is a point to check)
describe.skip('points to check: email type not mapped', () => {
  it('names each active email type mapped onto no doctrine type', () => {
    const points = check({
      values: [
        emailType('com', { doctrineType: 'editorial' }),
        emailType('enq', { doctrineType: null }),
        emailType('old', { doctrineType: null, isActive: false }),
      ],
    });

    expect(points).toEqual([
      { kind: 'emailTypeNotMapped', dimension: 'emailType', valueId: 'enq' },
    ]);
  });
});

// Turned on by #1636 (the template receives the doctrine type as doctrineType)
describe('points to check: doctrineType literal outside the doctrine', () => {
  it('names the literals a template compares doctrineType with, outside the doctrine', () => {
    const points = check({
      values: [emailType('com', { doctrineType: 'editorial' })],
      templates: [
        {
          id: 'tpl-footer',
          contract: {
            compared: [
              { property: 'doctrineType', literal: 'transactional', count: 1 },
              { property: 'doctrineType', literal: 'editoral', count: 2 },
              { property: 'doctrineType', literal: 'newsletter', count: 1 },
            ],
          },
        },
      ],
    });

    expect(points).toEqual([
      {
        kind: 'doctrineLiteralUnknown',
        dimension: 'emailType',
        identifiers: ['editoral', 'newsletter'],
        templateIds: ['tpl-footer'],
      },
    ]);
  });
});
