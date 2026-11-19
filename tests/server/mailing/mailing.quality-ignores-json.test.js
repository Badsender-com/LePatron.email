'use strict';

// The ignored quality findings reach the editor with its own metadata and
// nowhere else: no API answer serializing a mailing may carry them, nor the
// ids of who ignored them (read, transferToUser…).

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {},
  Workspaces: {},
  Galleries: {},
  Folders: {},
  Groups: {},
  Templates: {},
  TaxonomyItems: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');

const MailingSchema = require('../../../packages/server/mailing/mailing.schema.js');

describe('a mailing serialized for an API answer', () => {
  const Mailing = mongoose.model('MailingQualityIgnoresJson', MailingSchema);

  it('leaves the ignored quality findings out', () => {
    const mailing = new Mailing({
      name: 'Soldes',
      qualityIgnores: [
        {
          fingerprint: 'unfilled-links|b1|-|x',
          _user: mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
        },
      ],
    });

    expect(mailing.qualityIgnores).toHaveLength(1);
    const json = mailing.toJSON();
    expect(json).not.toHaveProperty('qualityIgnores');
    expect(json.name).toBe('Soldes');
  });
});
