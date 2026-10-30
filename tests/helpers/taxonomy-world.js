'use strict';

/**
 * The companies, users and small readers shared by the taxonomy acceptance tests
 * (epic #1351). Two companies, so every test can check the tenant boundary.
 */

const COMPANY_A = '507f1f77bcf86cd799439a01';
const COMPANY_B = '507f1f77bcf86cd799439b01';

const adminA = { role: 'company_admin', group: { id: COMPANY_A } };
const techAdminA = { role: 'company_admin_tech', group: { id: COMPANY_A } };
const adminB = { role: 'company_admin', group: { id: COMPANY_B } };

const idOf = (doc) => String(doc.id || doc._id);

const idsOf = (list) => (list || []).map((value) => String(value));

// Tokens travel as a Mongoose Map on a document and as a plain object once
// serialised; a test compares their content, whichever it receives.
const plainTokens = (tokens) =>
  tokens instanceof Map ? Object.fromEntries(tokens) : { ...(tokens || {}) };

/**
 * The model collections the taxonomy services read, as in-memory fakes. Called
 * from a `jest.mock` factory, so it builds fresh collections per test file.
 */
function fakeTaxonomyModels() {
  // Required here rather than at the top: a jest.mock factory may only reach
  // what it requires itself.
  const { fakeCollection } = require('./fake-collection.js');
  return {
    TaxonomyDimensions: fakeCollection({
      defaults: { isActive: true, order: 0, precedence: 0 },
      unique: [['_company', 'name']],
    }),
    TaxonomyItems: fakeCollection({
      defaults: { isActive: true, order: 0 },
      unique: [['_company', 'type', 'label']],
    }),
    Mailings: fakeCollection(),
    Groups: fakeCollection(),
    Templates: fakeCollection(),
    Workspaces: fakeCollection(),
    Folders: fakeCollection(),
    Galleries: fakeCollection(),
  };
}

function resetTaxonomyModels(models) {
  [
    'TaxonomyDimensions',
    'TaxonomyItems',
    'Mailings',
    'Groups',
  ].forEach((name) => models[name].reset());
}

module.exports = {
  COMPANY_A,
  COMPANY_B,
  adminA,
  techAdminA,
  adminB,
  idOf,
  idsOf,
  plainTokens,
  fakeTaxonomyModels,
  resetTaxonomyModels,
};
