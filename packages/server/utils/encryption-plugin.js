const logger = require('./logger.js');
const { encrypt, decrypt, isEncrypted } = require('./crypto');

/**
 * Decrypts the encrypted fields of one document read from the database. A
 * field that does not decrypt (altered, or written under another key) is
 * logged, never its value, and left out of the document, unchanged in the
 * database: the feature that needs that secret fails, not the whole query.
 *
 * @param {Object} doc a document, hydrated or lean
 * @param {string[]} fields
 * @param {string} label who reads it, for the log
 */
function decryptFields(doc, fields, label) {
  if (!doc) return;
  fields.forEach((field) => {
    if (!(doc[field]?.length > 32)) return;
    try {
      doc[field] = decrypt(doc[field]);
    } catch (error) {
      logger.error(
        `[encryption] ${label} ${doc._id} ${field} does not decrypt: left out`
      );
      if (typeof doc.set === 'function') {
        doc.set(field, undefined);
        // Not written back on a save: the stored value stays as it is.
        doc.unmarkModified(field);
      } else {
        doc[field] = undefined;
      }
    }
  });
}

function encryptionPlugin(schema, encryptedFields = []) {
  // Read by scripts/reencrypt-secrets.js, which must cover every field.
  schema.encryptedFields = encryptedFields;

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
      // A value saved twice in the same document is encrypted once.
      if (data[field] && !isEncrypted(data[field])) {
        data[field] = encrypt(data[field]);
      }
    });
    next();
  });

  // Decrypt on findOne or find
  schema.post(['findOne', 'find'], function (result) {
    const label = (this.model && this.model.modelName) || 'document';
    const docs = Array.isArray(result) ? result : [result];
    docs.forEach((doc) => decryptFields(doc, encryptedFields, label));
  });
}

module.exports = encryptionPlugin;
module.exports.decryptFields = decryptFields;
