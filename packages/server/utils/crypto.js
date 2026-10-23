const crypto = require('crypto');
const config = require('../node.config');

// Secrets stored in the database (ESP keys, integration keys, FTP access)
// are encrypted with AES-256-GCM, which also detects a value that was
// altered: decrypting one throws. They carry the `gcm:` prefix. A value
// encrypted with a context (the model, the document's id and the field, as
// the encryption plugin gives it) reads with that context only: one copied
// into another record or field throws too.
//
// Values written before, in AES-256-CTR, are still read while
// `encryptionLegacyReads` is on, and written again in GCM on their next save
// (scripts/reencrypt-secrets.js does it at once). CTR detects nothing, and a
// GCM value can be turned into a CTR one, so integrity holds once those
// reads are off (ENCRYPTION_LEGACY_READS=false), after the script.
const GCM = 'aes-256-gcm';
const GCM_PREFIX = 'gcm:';
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

const LEGACY = 'aes-256-ctr';
const LEGACY_IV_LENGTH = 16;

const encryptionKey = config.encryptionKey;
const MIN_GCM_HEX = (GCM_IV_LENGTH + GCM_TAG_LENGTH) * 2;

/**
 * @param {string} text
 * @param {string} [context] what the value is bound to: decrypting it takes
 *   the same one
 * @returns {string|undefined}
 */
const encrypt = (text, context) => {
  if (!text) return;
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM, encryptionKey, iv);
  if (context) cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${GCM_PREFIX}${iv.toString('hex')}${cipher
    .getAuthTag()
    .toString('hex')}${encrypted.toString('hex')}`;
};

const isEncrypted = (value) =>
  typeof value === 'string' && value.startsWith(GCM_PREFIX);

const isLegacyEncrypted = (value) =>
  typeof value === 'string' && !value.startsWith(GCM_PREFIX);

function decryptGcm(value, context) {
  const hex = value.slice(GCM_PREFIX.length);
  // A shortened value would carry a shorter tag, which Node accepts.
  if (hex.length < MIN_GCM_HEX) throw new Error('encrypted value too short');
  const iv = Buffer.from(hex.slice(0, GCM_IV_LENGTH * 2), 'hex');
  const tagEnd = (GCM_IV_LENGTH + GCM_TAG_LENGTH) * 2;
  const tag = Buffer.from(hex.slice(GCM_IV_LENGTH * 2, tagEnd), 'hex');
  const content = Buffer.from(hex.slice(tagEnd), 'hex');
  const decipher = crypto.createDecipheriv(GCM, encryptionKey, iv, {
    authTagLength: GCM_TAG_LENGTH,
  });
  if (context) decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(content), decipher.final()]).toString();
}

function decryptLegacy(hash) {
  const iv = Buffer.from(hash.substring(0, LEGACY_IV_LENGTH * 2), 'hex');
  const content = Buffer.from(hash.substring(LEGACY_IV_LENGTH * 2), 'hex');
  const decipher = crypto.createDecipheriv(LEGACY, encryptionKey, iv);
  return Buffer.concat([decipher.update(content), decipher.final()]).toString();
}

/**
 * @param {string} value
 * @param {string} [context] the one it was encrypted with (a value in the
 *   former format has none)
 * @returns {string}
 */
function decrypt(value, context) {
  if (!isLegacyEncrypted(value)) return decryptGcm(value, context);
  if (!config.encryptionLegacyReads) {
    throw new Error('value in the former format, legacy reads are off');
  }
  return decryptLegacy(value);
}

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
  isEncrypted,
  isLegacyEncrypted,
  getMd5FromBlob,
};
