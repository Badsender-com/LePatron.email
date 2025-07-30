const { encrypt, decrypt } = require('./crypto');

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
      if (data[field]) {
        data[field] = encrypt(data[field]);
      }
    });
    next();
  });

  // Decrypt on findOne or find
  schema.post(['findOne', 'find'], function (result) {
    const processDoc = (doc) => {
      if (!doc) return;
      encryptedFields.forEach((field) => {
        if (doc[field]?.length > 32) {
          doc[field] = decrypt(doc[field]);
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
