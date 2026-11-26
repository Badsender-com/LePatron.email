'use strict';

/**
 * A Mongoose schema plugged into an in-memory fake model (fake-collection.js):
 * what Mongoose 5.13 does with a record before MongoDB sees it.
 *
 * The schema is compiled on a Mongoose instance of its own, never connected,
 * so its casts, setters (`trim`), defaults and validators (`required`, `enum`,
 * `match`, `maxlength`, custom ones) are Mongoose's own, not a copy of them.
 * Its aliases (`group` for `_company`) and its `timestamps` are read from it.
 */

const { Mongoose } = require('mongoose');

// The record as stored: no virtual, no getter, no transform.
const STORED = Object.freeze({
  virtuals: false,
  getters: false,
  transform: false,
  depopulate: true,
  // MongoDB stores a map as a plain object, which a lean read answers.
  flattenMaps: true,
  versionKey: false,
});

function timestampFields(option) {
  if (!option) return {};
  const named = (key, fallback) => {
    if (option === true) return fallback;
    if (option[key] === false) return undefined;
    return typeof option[key] === 'string' ? option[key] : fallback;
  };
  return {
    createdAt: named('createdAt', 'createdAt'),
    updatedAt: named('updatedAt', 'updatedAt'),
  };
}

/**
 * @param {import('mongoose').Schema} [schema]
 * @returns {Object|null} what the fake needs of the schema, or null without one
 */
function fakeSchema(schema) {
  if (!schema) return null;

  const Model = new Mongoose().model('FakeCollection', schema);
  const timestamps = timestampFields(schema.options.timestamps);

  // `defaults: false` on an update or a save: Mongoose fills a default on
  // insert only. The `_id` is always in the record by then.
  const documentOf = (record, { defaults }) =>
    new Model(record, null, { defaults });

  function defaultsOf() {
    const { _id, ...defaults } = new Model({}).toObject(STORED);
    return defaults;
  }

  /**
   * Cast and validate a whole record, as `create`, `insertMany` and `save` do.
   *
   * @returns {Promise<Object>} the record as stored
   * @throws a Mongoose ValidationError
   */
  async function validated(record, { defaults = false } = {}) {
    const document = documentOf(record, { defaults });
    await document.validate();
    return document.toObject(STORED);
  }

  /**
   * Cast a record an update produced. A value that does not cast throws, as
   * it does in an update; the validators run only with `runValidators`, and
   * only on the paths the update names, as Mongoose's update validators do.
   *
   * @returns {Promise<Object>} the record as stored
   */
  async function castUpdate(record, paths, { runValidators = false } = {}) {
    const document = documentOf(record, { defaults: false });
    if (runValidators) {
      await document.validate(paths);
    } else {
      const error = document.validateSync(paths);
      const castError =
        error &&
        Object.values(error.errors).find((inner) => inner.name === 'CastError');
      if (castError) throw castError;
    }
    return document.toObject(STORED);
  }

  return {
    aliases: { ...schema.aliases },
    timestamps,
    virtualsIn: {
      toJSON: !!schema.options.toJSON?.virtuals,
      toObject: !!schema.options.toObject?.virtuals,
    },
    defaultsOf,
    validated,
    castUpdate,
  };
}

module.exports = { fakeSchema };
