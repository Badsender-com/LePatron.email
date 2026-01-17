const { encrypt, decrypt } = require('./crypto');
const _ = require('lodash');

function encryptionPlugin(schema, encryptedFields = []) {
  // Encrypt on save
  schema.pre('save', function (next) {
    encryptedFields.forEach((field) => {
      const value = _.get(this, field);
      if (value) {
        _.set(this, field, encrypt(value));
      }
    });
    next();
  });

  // Encrypt on updateOne - handle $set operator
  schema.pre('updateOne', function (next) {
    const update = this.getUpdate();

    // Check both direct fields and fields under $set
    encryptedFields.forEach((field) => {
      // Check direct field (rare, but possible)
      const directValue = _.get(update, field);
      if (directValue) {
        _.set(update, field, encrypt(directValue));
      }

      // Check field under $set (most common case)
      if (update.$set) {
        const setValue = _.get(update.$set, field);
        if (setValue) {
          _.set(update.$set, field, encrypt(setValue));
        }
      }
    });
    next();
  });

  // Decrypt on findOne or find
  schema.post(['findOne', 'find'], function (result) {
    const processDoc = (doc) => {
      if (!doc) return;
      encryptedFields.forEach((field) => {
        const value = _.get(doc, field);
        if (value?.length > 32) {
          _.set(doc, field, decrypt(value));
        }
      });
    };

    if (Array.isArray(result)) {
      result.forEach(processDoc);
    } else {
      processDoc(result);
    }
  });
}

module.exports = encryptionPlugin;
