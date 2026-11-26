'use strict';

/**
 * A Mongoose query of an in-memory fake model (fake-collection.js): a thenable
 * with the fluent API the services chain, `sort`, `select`, `limit` and
 * `lean`. Nothing runs until it is awaited or `exec` is called, and then `run`
 * answers the records, already filtered and in their final order.
 */

const { projected } = require('./fake-mongo-query.js');

/**
 * @param {Function} run `(state) => Promise<Object[]>`, reading `state.sort`
 * @param {Object} options
 * @param {Function} options.shape `(fields, lean) => result`, a projected
 *   record as a lean object or a document
 * @param {boolean} [options.single] answers the first record, or null
 * @param {*} [options.sort] @param {*} [options.projection]
 * @param {boolean} [options.lean]
 * @returns {Object} the query
 */
function fakeQuery(
  run,
  { shape, single = false, sort, projection, lean = false }
) {
  const state = { sort, projection, lean, limit: undefined };
  const exec = async () => {
    const found = await run(state);
    const kept =
      state.limit === undefined ? found : found.slice(0, state.limit);
    const shaped = kept.map((record) =>
      shape(projected(record, state.projection), state.lean)
    );
    return single ? shaped[0] || null : shaped;
  };
  const chain = {
    sort: (spec) => {
      state.sort = spec;
      return chain;
    },
    select: (spec) => {
      state.projection = spec;
      return chain;
    },
    limit: (count) => {
      state.limit = count;
      return chain;
    },
    lean: (flag = true) => {
      state.lean = !!flag;
      return chain;
    },
    exec,
    then: (resolve, reject) => exec().then(resolve, reject),
    catch: (reject) => exec().catch(reject),
  };
  return chain;
}

module.exports = { fakeQuery };
