'use strict';

/**
 * Loaded by Node's own `require` (see native-oidc-provider.js), so the objects
 * and arrays it builds belong to Node's realm, not to the test's sandbox.
 */

// A copy of `value` whose plain objects and arrays are of this realm; the
// rest (functions, class instances, primitives) is kept as it is.
function toNativeRealm(value) {
  if (Array.isArray(value)) return value.map(toNativeRealm);
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(Object.getPrototypeOf(value)) === null
  ) {
    const copy = {};
    Object.keys(value).forEach((key) => {
      copy[key] = toNativeRealm(value[key]);
    });
    return copy;
  }
  return value;
}

// The clock of this realm, which the provider reads: a test's own `Date` is
// the sandbox's, and moving it leaves the provider's time as it is.
const NativeDate = Date;

module.exports = { toNativeRealm, NativeDate };
