'use strict';

// The skills and expertises written before audiences were used by every
// company (ADR 0013): the migration opens those with no audience to all, and
// leaves alone one already set, the platform company's above all.

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
  it('selects a skill or an expertise that has no audience', () => {
    expect(matches({ skillId: 'qc.subject' }, WITHOUT_AUDIENCE)).toBe(true);
  });

  it.each(['platform', 'all'])(
    'leaves alone one whose audience is %s',
    (audience) => {
      expect(
        matches({ skillId: 'qc.subject', audience }, WITHOUT_AUDIENCE)
      ).toBe(false);
    }
  );

  it('opens to every company those with no audience', async () => {
    const model = fakeModel([
      { skillId: 'qc.subject' },
      { skillId: 'qc.cta', audience: 'platform' },
    ]);

    await expect(migrate(model, { dryRun: false })).resolves.toBe(1);
    expect(model.updateMany).toHaveBeenCalledWith(WITHOUT_AUDIENCE, {
      $set: { audience: 'all' },
    });
  });

  it('writes nothing on a dry run', async () => {
    const model = fakeModel([{ skillId: 'qc.subject' }]);

    await expect(migrate(model, { dryRun: true })).resolves.toBe(1);
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('writes nothing once every one has an audience', async () => {
    const model = fakeModel([{ skillId: 'qc.subject', audience: 'all' }]);

    await expect(migrate(model, { dryRun: false })).resolves.toBe(0);
    expect(model.updateMany).not.toHaveBeenCalled();
  });
});
