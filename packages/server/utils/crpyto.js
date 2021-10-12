const crypto = require('crypto');
// https://attacomsian.com/blog/nodejs-encrypt-decrypt-data
const algorithm = 'aes-256-ctr';
const secretKey = 'vOVH6sdmpNWjRRIqCc734^s01lwHzrt6';
const iv = crypto.randomBytes(16);

const encrypt = (text) => {
  if (!text) return;
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return iv.toString('hex') + encrypted.toString('hex');
};

const decrypt = (hash) => {
  const iv = hash.substring(0, 32);
  const content = hash.substring(32);

  const decipher = crypto.createDecipheriv(
    algorithm,
    secretKey,
    Buffer.from(iv, 'hex')
  );

  const decrpyted = Buffer.concat([
    decipher.update(Buffer.from(content, 'hex')),
    decipher.final(),
  ]);

  return decrpyted.toString();
};

module.exports = {
  encrypt,
  decrypt,
};
