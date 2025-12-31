const { encrypt, decrypt } = require('./crypto');
const _ = require('lodash');

function encryptionPlugin(schema, encryptedFields = []) {
  // Encrypt on save or updateOne
  schema.pre(['save', 'updateOne'], function (next) {
    let data;
    if (this.isNew || this.isModified) {
      // 'save' hook: 'this' is the document
      data = this;
    } else {
      // 'updateOne' hook: 'this' is the query
      data = this.getUpdate();
    }

    encryptedFields.forEach((field) => {
      const value = _.get(data, field);
      if (value) {
        _.set(data, field, encrypt(value));
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
