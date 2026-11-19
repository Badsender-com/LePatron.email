'use strict';

/**
 * `oidc-provider`, as the app requires it in Node 24.
 *
 * The package is ESM only. Node 24 lets the CommonJS app `require()` it
 * (ADR 0012), but Jest 27 loads modules itself and does not: this module,
 * mapped in jest.config.js, hands the test the package Node's own `require`
 * loads, with its dependencies, outside Jest's registry. Nothing in it is
 * mocked by a test. Gone with a Jest that loads ESM (30 and later).
 *
 * The provider tells a plain object by its prototype, and the test's objects
 * have the sandbox's: its configuration is copied into Node's realm first.
 */

// Node's own, not the one Jest hands a test for `require('module')`.
const { createRequire } = process.getBuiltinModule('module');

const nativeRequire = createRequire(__filename);
const oidc = nativeRequire('oidc-provider');
const { toNativeRealm } = nativeRequire('./native-realm.js');

class Provider extends oidc.default {
  constructor(issuer, configuration) {
    super(issuer, toNativeRealm(configuration));
  }
}

module.exports = { ...oidc, default: Provider, Provider };
