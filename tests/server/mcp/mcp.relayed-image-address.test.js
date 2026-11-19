'use strict';

// The signed address of a relayed image (ADR 0022), under a key of its own:
// replacing the key cuts every address signed before, and signs nobody out.

const ADDRESS = '../../../packages/server/mcp/mcp-relayed-image-address.js';
const CONFIG = '../../../packages/server/node.config.js';
const LOGO = 'https://cdn.example.test/brand/logo.png';

// The address module, loaded on an instance whose key is this one.
function loadWithKey(relayedImagesKey) {
  let address;
  jest.isolateModules(() => {
    // eslint-disable-next-line import/no-dynamic-require
    Object.assign(require(CONFIG), { relayedImagesKey });
    // eslint-disable-next-line import/no-dynamic-require
    address = require(ADDRESS);
  });
  return address;
}

const signatureIn = (relayedUrl) => new URL(relayedUrl).pathname.split('/')[3];

describe('the address of a relayed image', () => {
  const FIRST = `1:${'a'.repeat(32)}`;
  const SECOND = `2:${'b'.repeat(32)}`;

  it('carries the version of the key that signed it', () => {
    const address = loadWithKey(SECOND);

    expect(signatureIn(address.relayedUrlOf(LOGO))).toMatch(/^2\./);
  });

  it('is no longer valid once the key is replaced', () => {
    const before = loadWithKey(FIRST);
    const after = loadWithKey(SECOND);
    const signed = signatureIn(before.relayedUrlOf(LOGO));

    expect(before.isSigned(LOGO, signed)).toBe(true);
    expect(after.isSigned(LOGO, signed)).toBe(false);
  });

  it('is signed without a key of its own by one derived from the session secret, version 0', () => {
    const once = loadWithKey(undefined);
    const again = loadWithKey(undefined);
    const signed = signatureIn(once.relayedUrlOf(LOGO));

    expect(signed).toMatch(/^0\./);
    expect(again.isSigned(LOGO, signed)).toBe(true);
    expect(loadWithKey(FIRST).isSigned(LOGO, signed)).toBe(false);
  });

  it.each([
    ['without a version', 'a'.repeat(40)],
    ['with version 0', `0:${'a'.repeat(32)}`],
    ['with a short secret', '1:short'],
  ])('refuses a key written %s', (_case, relayedImagesKey) => {
    expect(() => loadWithKey(relayedImagesKey)).toThrow(
      /lepatron_relayedImagesKey/
    );
  });
});
