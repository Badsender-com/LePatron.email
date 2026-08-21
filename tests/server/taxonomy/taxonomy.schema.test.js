'use strict';

// `trimString`, the shared setter, does `String(value).trim()`. So clearing an
// optional field by assigning `undefined` stored the literal string "undefined",
// and the taxonomy table showed a chip reading "undefined" instead of the empty
// placeholder. Found in the browser, not by a test — hence this file.
//
// Exercised against a real Mongoose model, because the bug lives in the setter:
// a mocked document would never run it.

const mongoose = require('mongoose');

const TaxonomyItemSchema = require('../../../packages/server/taxonomy/taxonomy.schema.js');

const COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');

let TaxonomyItem;

beforeAll(() => {
  // A model name of its own, so registering it cannot collide with the app's.
  TaxonomyItem = mongoose.model('TaxonomyItemSchemaTest', TaxonomyItemSchema);
});

const build = (overrides) =>
  new TaxonomyItem({
    _company: COMPANY,
    type: 'emailType',
    label: 'Infolettre',
    ...overrides,
  });

describe('optional string setters', () => {
  it.each([[undefined], [null]])(
    'leaves canonicalType empty when cleared with %p',
    (value) => {
      const doc = build({ canonicalType: value });

      // NOT the string 'undefined' or 'null'.
      expect(doc.canonicalType == null).toBe(true);
      expect(typeof doc.canonicalType).not.toBe('string');
    }
  );

  it('still trims a real canonicalType', () => {
    expect(build({ canonicalType: '  promo  ' }).canonicalType).toBe('promo');
  });

  it('still trims the label', () => {
    expect(build({ label: '  Infolettre  ' }).label).toBe('Infolettre');
  });

  // Before the guard, `String(null)` produced 'null', which is a non-empty string
  // and therefore satisfied `required` — storing a typology literally named "null".
  it.each([[null], [undefined]])(
    'fails validation on a label of %p rather than storing its spelling',
    async (label) => {
      const error = build({ label }).validateSync();

      expect(error).toBeDefined();
      expect(error.errors.label).toBeDefined();
    }
  );

  it('leaves description alone, it has no setter', () => {
    expect(build({ description: '  gardée telle quelle  ' }).description).toBe(
      '  gardée telle quelle  '
    );
  });
});

describe('defaults', () => {
  it('creates an active item at order 0', () => {
    const doc = build();
    expect(doc.isActive).toBe(true);
    expect(doc.order).toBe(0);
  });

  it('exposes the company under the `group` alias', () => {
    expect(String(build().group)).toBe(String(COMPANY));
  });

  it.each([['language'], ['brand'], [''], ['emailtype']])(
    'refuses the unknown taxonomy type %p',
    (type) => {
      const error = build({ type }).validateSync();
      expect(error.errors.type).toBeDefined();
    }
  );
});

describe('length bounds', () => {
  it.each([
    ['label', 121],
    ['description', 2001],
    ['canonicalType', 61],
  ])('refuses %s past its limit', (field, length) => {
    const error = build({ [field]: 'x'.repeat(length) }).validateSync();
    expect(error.errors[field]).toBeDefined();
  });

  it.each([
    ['label', 120],
    ['description', 2000],
    ['canonicalType', 60],
  ])('accepts %s at exactly its limit', (field, length) => {
    const error = build({ [field]: 'x'.repeat(length) }).validateSync();
    expect(error).toBeUndefined();
  });
});
