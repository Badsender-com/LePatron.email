'use strict';

// MongoDB 4.4 and later refuse a projection naming both a path and one of its
// sub-paths ("Path collision"). Mongoose adds to a query the exclusions of the
// schema's `select: false` fields: one of those under a field the lists
// already exclude would break every list of mailings.

jest.mock('../../../packages/server/common/models.common.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');

const MailingSchema = require('../../../packages/server/mailing/mailing.schema.js');
const {
  MAILING_LIST_PROJECTION,
} = require('../../../packages/server/constant/mailing-list-projection.js');

// The projection Mongoose sends to the server, schema defaults included.
function sentProjection(query) {
  query._applyPaths();
  return Object.keys(query._fields || {});
}

describe('the projection of a list of mailings', () => {
  const Mailing = mongoose.model('MailingListProjectionPaths', MailingSchema);

  it('never names both a path and one of its sub-paths', () => {
    const paths = sentProjection(Mailing.find({}, MAILING_LIST_PROJECTION));
    const collisions = paths.filter((path) =>
      paths.some((other) => other !== path && path.startsWith(`${other}.`))
    );
    expect(paths).toContain('qualityIgnores');
    expect(collisions).toEqual([]);
  });
});
