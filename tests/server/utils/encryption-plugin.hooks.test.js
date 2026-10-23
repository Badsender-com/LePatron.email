'use strict';

// The writes of the encryption plugin, run through the hooks Mongoose runs
// before a save and an updateOne, without a database: what reaches MongoDB
// is encrypted, and bound to its model, its document and its field.

process.env.ENCRYPTION_KEY = 'a-test-encryption-key-32-bytes!!';
// The rollout's last step: the application writes GCM. Before it, see
// encryption-plugin.rollback.test.js.
process.env.ENCRYPTION_WRITE_GCM = 'true';

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');

const { decrypt } = require('../../../packages/server/utils/crypto.js');
const ProfileSchema = require('../../../packages/server/profile/profile.schema.js');
const {
  ProfileModel,
} = require('../../../packages/server/constant/model.names.js');

const Profiles = mongoose.model(ProfileModel, ProfileSchema);

// The pre hooks of `name`, on `context`, as Mongoose runs them before the
// operation (timestamps included).
const runPreHooks = (name, context) =>
  new Promise((resolve, reject) =>
    ProfileSchema.s.hooks.execPre(name, context, [], (error) =>
      error ? reject(error) : resolve()
    )
  );

describe('writing a secret', () => {
  it('encrypts the API key of a new profile too', async () => {
    const profile = new Profiles({ name: 'ESP', apiKey: 'an-api-key' });

    await runPreHooks('save', profile);

    expect(decrypt(profile.apiKey, `Profile:${profile._id}:apiKey`)).toBe(
      'an-api-key'
    );
  });

  it('encrypts it on save, bound to its document', async () => {
    const profile = new Profiles({ name: 'ESP', apiKey: 'k', secretKey: 's' });

    await runPreHooks('save', profile);

    expect(profile.secretKey).toMatch(/^gcm:/);
    expect(decrypt(profile.secretKey, `Profile:${profile._id}:secretKey`)).toBe(
      's'
    );
  });

  it('encrypts it on updateOne, next to the $set Mongoose adds', async () => {
    const id = new mongoose.Types.ObjectId();
    const query = Profiles.updateOne({ _id: id }, { secretKey: 'updated' });

    await runPreHooks('updateOne', query);

    const update = query.getUpdate();
    expect(update.$set).toBeDefined();
    expect(update.secretKey).toMatch(/^gcm:/);
    expect(decrypt(update.secretKey, `Profile:${id}:secretKey`)).toBe(
      'updated'
    );
  });

  it('encrypts it under $set too', async () => {
    const id = new mongoose.Types.ObjectId();
    const query = Profiles.updateOne(
      { _id: id },
      { $set: { accessToken: 'a-token' } }
    );

    await runPreHooks('updateOne', query);

    expect(
      decrypt(query.getUpdate().$set.accessToken, `Profile:${id}:accessToken`)
    ).toBe('a-token');
  });

  it('refuses an update that does not name its document', async () => {
    const query = Profiles.updateOne({ name: 'ESP' }, { secretKey: 's' });

    await expect(runPreHooks('updateOne', query)).rejects.toThrow(
      /by document _id/
    );
  });
});
