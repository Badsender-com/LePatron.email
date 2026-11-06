'use strict';

// The skills and expertises written before audiences were used by every
// company (ADR 0013): the migration opens to all those with no audience, a
// null one, or `subscribers` (the name `all` had on some test instances), and
// leaves alone `platform` and `all`.

const {
  WITHOUT_AUDIENCE,
  migrate,
} = require('../../scripts/migrate-audience-all.js');
const { matches } = require('../helpers/fake-mongo-query.js');

// A model holding the documents given, as the migration queries it.
function fakeModel(docs) {
  return {
    countDocuments: jest.fn(
      async (query) => docs.filter((doc) => matches(doc, query)).length
    ),
    updateMany: jest.fn(async () => ({})),
  };
}

describe('migrate-audience-all', () => {
  it.each([
    ['no audience', { skillId: 'qc.subject' }],
    ['a null audience', { skillId: 'qc.subject', audience: null }],
    [
      'the former name of all',
      { skillId: 'qc.subject', audience: 'subscribers' },
    ],
  ])('selects a skill or an expertise that has %s', (_case, doc) => {
    expect(matches(doc, WITHOUT_AUDIENCE)).toBe(true);
  });

  it.each(['platform', 'all'])(
    'leaves alone one whose audience is %s',
    (audience) => {
      expect(
        matches({ skillId: 'qc.subject', audience }, WITHOUT_AUDIENCE)
      ).toBe(false);
    }
  );

  it('opens to every company those with no audience, a null one or the former name', async () => {
    const model = fakeModel([
      { skillId: 'qc.subject' },
      { skillId: 'qc.preheader', audience: null },
      { skillId: 'qc.footer', audience: 'subscribers' },
      { skillId: 'qc.cta', audience: 'platform' },
      { skillId: 'qc.links', audience: 'all' },
    ]);

    await expect(migrate(model, { dryRun: false })).resolves.toBe(3);
    expect(model.updateMany).toHaveBeenCalledWith(
      WITHOUT_AUDIENCE,
      { $set: { audience: 'all' } },
      { timestamps: false }
    );
  });

  it('writes nothing on a dry run', async () => {
    const model = fakeModel([
      { skillId: 'qc.subject' },
      { skillId: 'qc.footer', audience: 'subscribers' },
    ]);

    await expect(migrate(model, { dryRun: true })).resolves.toBe(2);
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('writes nothing once every one has an audience', async () => {
    const model = fakeModel([{ skillId: 'qc.subject', audience: 'all' }]);

    await expect(migrate(model, { dryRun: false })).resolves.toBe(0);
    expect(model.updateMany).not.toHaveBeenCalled();
  });
});
