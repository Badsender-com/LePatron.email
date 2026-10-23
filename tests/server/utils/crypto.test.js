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

  it('refuses a value shortened to a weaker tag', () => {
    const stored = encrypt('an ESP secret key');
    const shortened = stored.slice(0, 'gcm:'.length + 24 + 8);

    expect(() => decrypt(shortened)).toThrow();
  });

  it('refuses the former format once its reads are off', () => {
    const stored = legacyEncrypt('an FTP password');
    jest.isolateModules(() => {
      process.env.ENCRYPTION_LEGACY_READS = 'false';
      const strict = require('../../../packages/server/utils/crypto.js');
      delete process.env.ENCRYPTION_LEGACY_READS;

      expect(() => strict.decrypt(stored)).toThrow(/legacy reads are off/);
    });
  });

  it('encrypts nothing for an empty value', () => {
    expect(encrypt('')).toBeUndefined();
  });
});

describe('binding a value to its record', () => {
  it('reads it back with the context it was written with', () => {
    const stored = encrypt('an ESP secret key', 'Profile:p1:secretKey');

    expect(decrypt(stored, 'Profile:p1:secretKey')).toBe('an ESP secret key');
  });

  it('refuses it copied into another record', () => {
    const stored = encrypt('an ESP secret key', 'Profile:p1:secretKey');

    expect(() => decrypt(stored, 'Profile:p2:secretKey')).toThrow();
  });

  it('refuses it copied into another field', () => {
    const stored = encrypt('an FTP password', 'Company:g1:ftpPassword');

    expect(() => decrypt(stored, 'Company:g1:ftpSshKey')).toThrow();
  });
});

describe('rewriting the former format', () => {
  const { planReencryption } = require('../../../scripts/reencrypt-secrets.js');
  const INTEGRATION = { model: 'Integration', fields: ['apiKey'] };
  const COMPANY = { model: 'Company', fields: ['ftpPassword', 'ftpSshKey'] };

  it('rewrites a value in the former format, bound to its record, to the same secret', () => {
    const { set } = planReencryption(
      { _id: 'i1', apiKey: legacyEncrypt('a key') },
      INTEGRATION
    );

    expect(set.apiKey).toMatch(/^gcm:/);
    expect(decrypt(set.apiKey, 'Integration:i1:apiKey')).toBe('a key');
    expect(() => decrypt(set.apiKey, 'Integration:i2:apiKey')).toThrow();
  });

  it('reads nested fields, unbound where the code reads them unbound', () => {
    const doc = {
      _id: 'u1',
      twoFactor: { secret: legacyEncrypt('JBSWY3DPEHPK3PXP') },
    };

    const { set } = planReencryption(doc, {
      model: 'User',
      fields: ['twoFactor.secret'],
      bound: false,
    });

    expect(decrypt(set['twoFactor.secret'])).toBe('JBSWY3DPEHPK3PXP');
  });

  it('leaves a value already rewritten, so a rerun writes nothing', () => {
    expect(
      planReencryption(
        { _id: 'i1', apiKey: encrypt('a key', 'Integration:i1:apiKey') },
        INTEGRATION
      ).set
    ).toBeNull();
  });

  it('leaves a field that is absent', () => {
    expect(planReencryption({ _id: 'g1' }, COMPANY).set).toBeNull();
  });

  it('rewrites a secret with accents, which is text', () => {
    const { set } = planReencryption(
      { _id: 'g1', ftpPassword: legacyEncrypt('été-2026') },
      COMPANY
    );

    expect(decrypt(set.ftpPassword, 'Company:g1:ftpPassword')).toBe('été-2026');
  });

  it('leaves a value that is not even hex, rather than stop the run', () => {
    const plan = planReencryption(
      {
        _id: 'g1',
        ftpSshKey: '-----BEGIN OPENSSH PRIVATE KEY----- written in clear',
      },
      COMPANY
    );

    expect(plan).toEqual({ set: null, unreadable: ['ftpSshKey'] });
  });

  it('covers every field the schemas encrypt', () => {
    const { TARGETS } = require('../../../scripts/reencrypt-secrets.js');
    const fields = TARGETS.flatMap(({ fields: list }) => list);

    expect(fields).toEqual(
      expect.arrayContaining([
        'secretKey',
        'accessToken',
        'ftpPassword',
        'ftpSshKey',
        'apiKey',
      ])
    );
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

    const plan = planReencryption({ _id: 'i1', apiKey: stored }, INTEGRATION);

    expect(plan.set).toBeNull();
    expect(plan.unreadable).toEqual(['apiKey']);
  });
});
