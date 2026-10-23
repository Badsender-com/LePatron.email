const crypto = require('crypto');
const config = require('../node.config');

// Secrets stored in the database (ESP keys, integration keys, FTP access)
// are encrypted with AES-256-GCM, which also detects a value that was
// altered: decrypting one throws. They carry the `gcm:` prefix. Values
// written before it, in AES-256-CTR, are still read, and written again in
// GCM on their next save (scripts/reencrypt-secrets.js does it at once).
const GCM = 'aes-256-gcm';
const GCM_PREFIX = 'gcm:';
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

const LEGACY = 'aes-256-ctr';
const LEGACY_IV_LENGTH = 16;

const encryptionKey = config.encryptionKey;

const encrypt = (text) => {
  if (!text) return;
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${GCM_PREFIX}${iv.toString('hex')}${cipher
    .getAuthTag()
    .toString('hex')}${encrypted.toString('hex')}`;
};

const isLegacyEncrypted = (value) =>
  typeof value === 'string' && !value.startsWith(GCM_PREFIX);

function decryptGcm(value) {
  const hex = value.slice(GCM_PREFIX.length);
  const iv = Buffer.from(hex.slice(0, GCM_IV_LENGTH * 2), 'hex');
  const tagEnd = (GCM_IV_LENGTH + GCM_TAG_LENGTH) * 2;
  const tag = Buffer.from(hex.slice(GCM_IV_LENGTH * 2, tagEnd), 'hex');
  const content = Buffer.from(hex.slice(tagEnd), 'hex');
  const decipher = crypto.createDecipheriv(GCM, encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(content), decipher.final()]).toString();
}

function decryptLegacy(hash) {
  const iv = Buffer.from(hash.substring(0, LEGACY_IV_LENGTH * 2), 'hex');
  const content = Buffer.from(hash.substring(LEGACY_IV_LENGTH * 2), 'hex');
  const decipher = crypto.createDecipheriv(LEGACY, encryptionKey, iv);
  return Buffer.concat([decipher.update(content), decipher.final()]).toString();
}

const decrypt = (value) =>
  isLegacyEncrypted(value) ? decryptLegacy(value) : decryptGcm(value);

const getMd5FromBlob = async (blob) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');

    const stream = blob.stream();
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

module.exports = {
  encrypt,
  decrypt,
  isLegacyEncrypted,
  getMd5FromBlob,
};
