'use strict';

// The secrets stored in the database are encrypted with AES-256-GCM, which
// detects a value that was altered; the values written before it, in
// AES-256-CTR, are still read.

const KEY = 'a-test-encryption-key-32-bytes!!';
process.env.ENCRYPTION_KEY = KEY;

const nodeCrypto = require('crypto');
const {
  encrypt,
  decrypt,
  isLegacyEncrypted,
} = require('../../../packages/server/utils/crypto.js');

// The format written until now: hex IV of 16 bytes, then the hex
// ciphertext, AES-256-CTR.
function legacyEncrypt(text) {
  const iv = nodeCrypto.randomBytes(16);
  const cipher = nodeCrypto.createCipheriv('aes-256-ctr', KEY, iv);
  return (
    iv.toString('hex') +
    Buffer.concat([cipher.update(text), cipher.final()]).toString('hex')
  );
}

describe('encrypting a stored secret', () => {
  it('reads back what it wrote', () => {
    expect(decrypt(encrypt('an ESP secret key'))).toBe('an ESP secret key');
  });

  it('writes the authenticated format, never twice the same', () => {
    const first = encrypt('an ESP secret key');

    expect(first).toMatch(/^gcm:[0-9a-f]+$/);
    expect(isLegacyEncrypted(first)).toBe(false);
    expect(encrypt('an ESP secret key')).not.toBe(first);
  });

  it('refuses a value altered in the database', () => {
    const stored = encrypt('an ESP secret key');
    const last = stored.slice(-1);
    const altered = stored.slice(0, -1) + (last === '0' ? '1' : '0');

    expect(() => decrypt(altered)).toThrow();
  });

  it('still reads a value written in the former format', () => {
    const stored = legacyEncrypt('an FTP password');

    expect(isLegacyEncrypted(stored)).toBe(true);
    expect(decrypt(stored)).toBe('an FTP password');
  });

  it('encrypts nothing for an empty value', () => {
    expect(encrypt('')).toBeUndefined();
  });
});

describe('rewriting the former format', () => {
  const { planReencryption } = require('../../../scripts/reencrypt-secrets.js');

  it('rewrites a value in the former format, to the same secret', () => {
    const { set } = planReencryption({ apiKey: legacyEncrypt('a key') }, [
      'apiKey',
    ]);

    expect(set.apiKey).toMatch(/^gcm:/);
    expect(decrypt(set.apiKey)).toBe('a key');
  });

  it('reads nested fields', () => {
    const doc = { twoFactor: { secret: legacyEncrypt('JBSWY3DPEHPK3PXP') } };

    const { set } = planReencryption(doc, ['twoFactor.secret']);

    expect(decrypt(set['twoFactor.secret'])).toBe('JBSWY3DPEHPK3PXP');
  });

  it('leaves a value already rewritten, so a rerun writes nothing', () => {
    expect(
      planReencryption({ apiKey: encrypt('a key') }, ['apiKey']).set
    ).toBeNull();
  });

  it('leaves a field that is absent', () => {
    expect(planReencryption({}, ['ftpPassword', 'ftpSshKey']).set).toBeNull();
  });

  it('leaves a value written under another key, rather than rewrite noise', () => {
    const iv = nodeCrypto.randomBytes(16);
    const cipher = nodeCrypto.createCipheriv(
      'aes-256-ctr',
      'another-key-of-thirty-two-bytes!',
      iv
    );
    const stored =
      iv.toString('hex') +
      Buffer.concat([
        cipher.update('a key of the ESP'),
        cipher.final(),
      ]).toString('hex');

    const plan = planReencryption({ apiKey: stored }, ['apiKey']);

    expect(plan.set).toBeNull();
    expect(plan.unreadable).toEqual(['apiKey']);
  });
});
