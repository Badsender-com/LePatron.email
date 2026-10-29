'use strict';

// The skills and expertises written before audiences keep reaching every
// subscribed group (ADR 0013): the migration opens those with no audience, and
// leaves alone one already set, the platform group's above all.

const {
  WITHOUT_AUDIENCE,
} = require('../../scripts/migrate-audience-subscribers.js');
const { matches } = require('../helpers/fake-mongo-query.js');

describe('migrate-audience-subscribers', () => {
  it('migrates a skill or an expertise that has no audience', () => {
    expect(matches({ skillId: 'qc.subject' }, WITHOUT_AUDIENCE)).toBe(true);
  });

  it.each(['platform', 'subscribers'])(
    'leaves alone one whose audience is %s',
    (audience) => {
      expect(
        matches({ skillId: 'qc.subject', audience }, WITHOUT_AUDIENCE)
      ).toBe(false);
    }
  );
});
