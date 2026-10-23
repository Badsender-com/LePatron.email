'use strict';

// Until ENCRYPTION_WRITE_GCM is on, the application writes its secrets as
// the previous version did (AES-256-CTR), so that version still reads every
// value written and can be rolled back to.

process.env.ENCRYPTION_KEY = 'a-test-encryption-key-32-bytes!!';
delete process.env.ENCRYPTION_WRITE_GCM;

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const nodeCrypto = require('crypto');
const mongoose = require('mongoose');

const ProfileSchema = require('../../../packages/server/profile/profile.schema.js');
const {
  ProfileModel,
} = require('../../../packages/server/constant/model.names.js');

const Profiles = mongoose.model(ProfileModel, ProfileSchema);

// How the previous version of the application decrypts (utils/crypto.js on
// develop before the change).
function previousVersionDecrypts(hash) {
  const iv = Buffer.from(hash.substring(0, 32), 'hex');
  const content = Buffer.from(hash.substring(32), 'hex');
  const decipher = nodeCrypto.createDecipheriv(
    'aes-256-ctr',
    process.env.ENCRYPTION_KEY,
    iv
  );
  return Buffer.concat([decipher.update(content), decipher.final()]).toString();
}

const runPreHooks = (name, context) =>
  new Promise((resolve, reject) =>
    ProfileSchema.s.hooks.execPre(name, context, [], (error) =>
      error ? reject(error) : resolve()
    )
  );

describe('before ENCRYPTION_WRITE_GCM is on', () => {
  it('saves a secret in the former format, which the previous version reads', async () => {
    const profile = new Profiles({ name: 'ESP', apiKey: 'k', secretKey: 's' });

    await runPreHooks('save', profile);

    expect(profile.secretKey).not.toMatch(/^gcm:/);
    expect(previousVersionDecrypts(profile.secretKey)).toBe('s');
  });

  it('updates a secret in the former format too', async () => {
    const query = Profiles.updateOne(
      { _id: new mongoose.Types.ObjectId() },
      { secretKey: 'updated' }
    );

    await runPreHooks('updateOne', query);

    expect(previousVersionDecrypts(query.getUpdate().secretKey)).toBe(
      'updated'
    );
  });
});

describe('the migration script, before ENCRYPTION_WRITE_GCM is on', () => {
  it('refuses to write', async () => {
    const script = require('../../../scripts/reencrypt-secrets.js');

    await expect(
      script.run({ dryRun: false, database: 'lepatron' })
    ).rejects.toThrow(/ENCRYPTION_WRITE_GCM=true/);
  });
});
