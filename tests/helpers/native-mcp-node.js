'use strict';

/**
 * `@modelcontextprotocol/node`, as the app requires it in Node 24.
 *
 * Its dependencies reach their CommonJS builds through `exports` only, which
 * Jest 27 does not read: this module, mapped in jest.config.js, hands the test
 * the adapter Node's own `require` loads, outside Jest's registry. The adapter
 * only converts the HTTP exchange and calls the handler it is given, which is
 * the app's. Gone with a Jest that reads `exports` (28 and later).
 */

// Node's own, not the one Jest hands a test for `require('module')`.
const { createRequire } = process.getBuiltinModule('module');

module.exports = createRequire(__filename)('@modelcontextprotocol/node');
