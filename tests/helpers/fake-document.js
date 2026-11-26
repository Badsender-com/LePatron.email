'use strict';

/**
 * A Mongoose document of an in-memory fake model (fake-collection.js): the
 * fields it was read with, and `id`, `save()`, `toObject()`, `toJSON()` and
 * the schema's aliases (`group` for `_company`), non-enumerable so a test
 * comparing it with `toEqual` sees data.
 *
 * Never the stored record itself: changing a document without saving it
 * changes nothing. `save()` hands the collection the fields as read and as
 * they are now, and the collection writes only what changed, as Mongoose
 * writes the modified paths.
 */

const { isDeepStrictEqual } = require('util');

const { comparable } = require('./fake-mongo-equality.js');
const { copyOf } = require('./fake-mongo-update.js');

// Whether two stored values are the same, as MongoDB would leave a field
// unmodified: an id or a date by its value, an array or an object field by
// field.
function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((element, index) => same(element, b[index]))
    );
  }
  if (a instanceof Map || b instanceof Map) return isDeepStrictEqual(a, b);
  const isObject = (value) =>
    value &&
    typeof value === 'object' &&
    !value._bsontype &&
    !(value instanceof Date);
  if (isObject(a) || isObject(b)) {
    if (!isObject(a) || !isObject(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => same(a[key], b[key]));
  }
  return comparable(a) === comparable(b);
}

/**
 * @param {Object} record the fields read, already projected
 * @param {Object} options
 * @param {Object|null} options.schema what fake-schema.js read of the schema
 * @param {Function} options.save `(loaded, current) => Promise<stored record>`
 * @returns {Object} the document
 */
function fakeDocument(record, { schema, save }) {
  const { updatedAt } = schema?.timestamps || {};
  const aliases = Object.entries(schema?.aliases || {});
  let loaded = copyOf(record);
  const document = copyOf(record);
  const data = () => copyOf({ ...document });
  const withVirtuals = (fields) => ({
    ...fields,
    ...Object.fromEntries(
      aliases.map(([alias, path]) => [alias, fields[path]])
    ),
    id: document.id,
  });

  Object.defineProperties(document, {
    id: { get: () => String(document._id) },
    save: {
      value: async () => {
        const current = data();
        const saved = await save(loaded, current);
        // The document sees its fields as stored (trimmed, cast), and still
        // only the fields it was read with.
        Object.keys(current).forEach((key) => {
          if (saved[key] === undefined) delete document[key];
          else document[key] = copyOf(saved[key]);
        });
        if (updatedAt) document[updatedAt] = saved[updatedAt];
        loaded = data();
        return document;
      },
    },
    toObject: {
      value: () =>
        schema?.virtualsIn.toObject ? withVirtuals(data()) : data(),
    },
    // Without a schema to say otherwise, every model of this codebase asks
    // for its virtuals in JSON.
    toJSON: {
      value: () =>
        !schema || schema.virtualsIn.toJSON ? withVirtuals(data()) : data(),
    },
    markModified: { value: () => {} },
  });
  aliases.forEach(([alias, path]) => {
    Object.defineProperty(document, alias, {
      get: () => document[path],
      set: (value) => {
        document[path] = value;
      },
    });
  });
  return document;
}

module.exports = { fakeDocument, same };
