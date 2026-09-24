'use strict';

const {
  planEmailTypeSeeding,
} = require('../../scripts/seed-default-email-types');

// The planning step answers one question: which companies have no email type of
// their own? Getting it wrong in the permissive direction re-seeds a company whose
// admin curated their list, which is the failure worth pinning.

const A = '507f1f77bcf86cd799439a01';
const B = '507f1f77bcf86cd799439b01';

describe('seed-default-email-types.planEmailTypeSeeding', () => {
  it('seeds a company that has no email type', () => {
    const { toSeed, alreadySeeded } = planEmailTypeSeeding(
      [{ _id: A, name: 'Acme' }],
      []
    );

    expect(toSeed).toEqual([{ id: A, name: 'Acme' }]);
    expect(alreadySeeded).toBe(0);
  });

  it('skips a company that already has one', () => {
    const { toSeed, alreadySeeded } = planEmailTypeSeeding(
      [
        { _id: A, name: 'Acme' },
        { _id: B, name: 'Globex' },
      ],
      [{ _company: B }]
    );

    expect(toSeed).toEqual([{ id: A, name: 'Acme' }]);
    expect(alreadySeeded).toBe(1);
  });

  // ObjectId, not string, is what Mongo actually hands back. Comparing without
  // normalising would find nothing in the Set and re-seed every company — right
  // into the unique index.
  it('matches ObjectId-like values against company ids', () => {
    const objectId = { toString: () => B };
    const { toSeed } = planEmailTypeSeeding(
      [{ _id: { toString: () => B }, name: 'Globex' }],
      [{ _company: objectId }]
    );

    expect(toSeed).toEqual([]);
  });

  it('counts a company once however many items it holds', () => {
    const { toSeed, alreadySeeded } = planEmailTypeSeeding(
      [{ _id: B, name: 'Globex' }],
      [{ _company: B }, { _company: B }, { _company: B }]
    );

    expect(toSeed).toEqual([]);
    expect(alreadySeeded).toBe(1);
  });

  it('ignores items with no company rather than counting them as one', () => {
    const { toSeed } = planEmailTypeSeeding(
      [{ _id: A, name: 'Acme' }],
      [{ _company: null }, {}, null]
    );

    expect(toSeed).toEqual([{ id: A, name: 'Acme' }]);
  });

  it('handles missing inputs', () => {
    expect(planEmailTypeSeeding()).toEqual({ toSeed: [], alreadySeeded: 0 });
  });
});
