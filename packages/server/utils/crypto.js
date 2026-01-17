const crypto = require('crypto');
const config = require('../node.config');

const algorithm = 'aes-256-ctr';
const encryptionKey = config.encryptionKey;

const IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + encrypted.toString('hex');
};

const decrypt = (hash) => {
  try {
    // Validate hash format: must be hex string with at least 32 chars for IV
    if (!hash || typeof hash !== 'string' || hash.length < 32) {
      return hash; // Return original value if not a valid encrypted format
    }
    // Check if it looks like encrypted data (hex string)
    if (!/^[0-9a-fA-F]+$/.test(hash)) {
      return hash; // Return original value if not hex
    }
    const iv = Buffer.from(hash.substring(0, 32), 'hex');
    const content = Buffer.from(hash.substring(32), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    // If decryption fails, return the original value
    // This handles cases where data wasn't encrypted or is corrupted
    console.warn('Decryption failed, returning original value:', error.message);
    return hash;
  }
};

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
  getMd5FromBlob,
};
