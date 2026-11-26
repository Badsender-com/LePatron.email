'use strict';

/**
 * The collection the fakeCollection tests share: two companies, one label each
 * would hold twice, an array field and a default. Required by
 * fake-collection*.test.js.
 */

const { fakeCollection } = require('./fake-collection.js');

const A = '507f1f77bcf86cd799439a01';
const B = '507f1f77bcf86cd799439b01';

function seededItems() {
  const items = fakeCollection({
    defaults: { isActive: true },
    unique: [['_company', 'label']],
  });
  items.seed([
    { _id: 'i1', _company: A, label: 'Canada', order: 2, tags: ['x', 'y'] },
    { _id: 'i2', _company: A, label: 'Belgique', order: 1, isActive: false },
    { _id: 'i3', _company: B, label: 'Canada', order: 3, tags: ['y'] },
  ]);
  return items;
}

module.exports = { A, B, seededItems };
