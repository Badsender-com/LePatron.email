'use strict';

// The company dimension values of an email (ADR-0032) are stored only once the
// email has some: an email of a company without dimensions keeps no empty list.

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

describe('the company dimension values of a mailing', () => {
  const Mailing = mongoose.model('MailingTaxonomyItemsDefault', MailingSchema);

  it('stores no list for an email that has no value', () => {
    const mailing = new Mailing({ name: 'Soldes' });

    expect(mailing._taxonomyItems).toBeUndefined();
    expect(mailing.toObject()).not.toHaveProperty('_taxonomyItems');
  });

  it('unsets the list once the values are cleared', () => {
    const id = mongoose.Types.ObjectId('507f1f77bcf86cd799439101');
    const mailing = Mailing.hydrate({
      _id: mongoose.Types.ObjectId('507f1f77bcf86cd799439001'),
      name: 'Soldes',
      _taxonomyItems: [id],
    });

    // What applyMetadataToMailing assigns when the request clears them.
    mailing._taxonomyItems = undefined;

    expect(mailing.isModified('_taxonomyItems')).toBe(true);
    expect(mailing.toObject()).not.toHaveProperty('_taxonomyItems');
  });

  it('stores the values an email has', () => {
    const id = mongoose.Types.ObjectId('507f1f77bcf86cd799439101');
    const mailing = new Mailing({ name: 'Soldes', _taxonomyItems: [id] });

    expect(mailing._taxonomyItems.map(String)).toEqual([String(id)]);
  });
});
