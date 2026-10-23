'use strict';

// The encryption plugin decrypts the secrets of the documents a query reads.
// One that does not decrypt fails alone: the query answers, without it.

process.env.ENCRYPTION_KEY = 'a-test-encryption-key-32-bytes!!';

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../packages/server/utils/logger.js');
const { encrypt } = require('../../../packages/server/utils/crypto.js');

// As the plugin writes it: bound to its model, its document and its field.
const stored = (value, id, field) => encrypt(value, `Company:${id}:${field}`);
const {
  decryptFields,
} = require('../../../packages/server/utils/encryption-plugin.js');

function altered(value) {
  const last = value.slice(-1);
  return value.slice(0, -1) + (last === '0' ? '1' : '0');
}

describe('decrypting the documents a query reads', () => {
  it('decrypts every encrypted field', () => {
    const doc = {
      _id: 'g1',
      ftpPassword: stored('a password', 'g1', 'ftpPassword'),
    };

    decryptFields(doc, ['ftpPassword'], 'Company');

    expect(doc.ftpPassword).toBe('a password');
  });

  it('leaves out a field that does not decrypt, and logs which, never its value', () => {
    const value = altered(stored('a password', 'g1', 'ftpPassword'));
    const doc = {
      _id: 'g1',
      ftpPassword: value,
      ftpSshKey: stored('a key', 'g1', 'ftpSshKey'),
    };

    decryptFields(doc, ['ftpPassword', 'ftpSshKey'], 'Company');

    expect(doc.ftpPassword).toBeUndefined();
    expect(doc.ftpSshKey).toBe('a key');
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).toContain('Company g1 ftpPassword');
    expect(logged).not.toContain(value);
  });

  it('does not write the field back when the document is saved', () => {
    const doc = {
      _id: 'g1',
      ftpPassword: altered(stored('a password', 'g1', 'ftpPassword')),
      set: jest.fn(function set(field, value) {
        this[field] = value;
      }),
      unmarkModified: jest.fn(),
    };

    decryptFields(doc, ['ftpPassword'], 'Company');

    expect(doc.unmarkModified).toHaveBeenCalledWith('ftpPassword');
  });
});

describe('a secret copied from another record', () => {
  it('is left out, like an altered one', () => {
    const doc = {
      _id: 'g2',
      ftpPassword: stored('the password of g1', 'g1', 'ftpPassword'),
    };

    decryptFields(doc, ['ftpPassword'], 'Company');

    expect(doc.ftpPassword).toBeUndefined();
  });
});
