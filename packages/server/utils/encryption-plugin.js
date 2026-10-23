const config = require('../node.config.js');
const logger = require('./logger.js');
const { encrypt, encryptLegacy, decrypt, isEncrypted } = require('./crypto');

/**
 * What a stored secret is bound to: its model, its document and its field.
 * A value copied into another record or field does not decrypt.
 *
 * @param {string} modelName
 * @param {*} id the document's `_id`
 * @param {string} field
 * @returns {string}
 */
const contextOf = (modelName, id, field) => `${modelName}:${id}:${field}`;

/**
 * Decrypts the encrypted fields of one document read from the database. A
 * field that does not decrypt (altered, copied from another record, or
 * written under another key) is logged, never its value, and left out of
 * the document, unchanged in the database: the feature that needs that
 * secret fails, not the whole query.
 *
 * @param {Object} doc a document, hydrated or lean
 * @param {string[]} fields
 * @param {string} modelName the model that read it
 */
function decryptFields(doc, fields, modelName) {
  if (!doc) return;
  fields.forEach((field) => {
    if (!(doc[field]?.length > 32)) return;
    try {
      doc[field] = decrypt(doc[field], contextOf(modelName, doc._id, field));
    } catch (error) {
      logger.error(
        `[encryption] ${modelName} ${doc._id} ${field} does not decrypt: left out`
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

/**
 * The value stored for a secret. In GCM, bound to its record, once
 * ENCRYPTION_WRITE_GCM is on; in the former format until then, so that the
 * previous version of the application still reads every value written and
 * can be rolled back to.
 */
const storedValueOf = (value, context) =>
  config.encryptionWriteGcm ? encrypt(value, context) : encryptLegacy(value);

// Where an update writes values: at its top level and under `$set`, both at
// once (Mongoose adds a `$set` of its own, for `updatedAt`).
function writtenPartsOf(query) {
  const update = query.getUpdate() || {};
  return [update, update.$set].filter(Boolean);
}

function encryptionPlugin(schema, encryptedFields = []) {
  // Read by scripts/reencrypt-secrets.js, which must cover every field.
  schema.encryptedFields = encryptedFields;

  schema.pre('save', function (next) {
    encryptedFields.forEach((field) => {
      // A value saved twice in the same document is encrypted once.
      if (this[field] && !isEncrypted(this[field])) {
        this[field] = storedValueOf(
          this[field],
          contextOf(this.constructor.modelName, this._id, field)
        );
      }
    });
    next();
  });

  schema.pre('updateOne', function (next) {
    const writes = [];
    writtenPartsOf(this).forEach((part) => {
      encryptedFields.forEach((field) => {
        if (part[field] && !isEncrypted(part[field]))
          writes.push({ part, field });
      });
    });
    if (writes.length === 0) return next();
    const written = writes.map(({ field }) => field);
    // The value is bound to its document: the update must name it.
    const { _id: id } = this.getFilter();
    if (!id || (typeof id === 'object' && !id.toHexString)) {
      return next(
        new Error(`${written.join(', ')} can only be written by document _id`)
      );
    }
    writes.forEach(({ part, field }) => {
      part[field] = storedValueOf(
        part[field],
        contextOf(this.model.modelName, id, field)
      );
    });
    next();
  });

  // Decrypt on findOne or find
  schema.post(['findOne', 'find'], function (result) {
    const modelName = (this.model && this.model.modelName) || 'document';
    const docs = Array.isArray(result) ? result : [result];
    docs.forEach((doc) => decryptFields(doc, encryptedFields, modelName));
  });
}

module.exports = encryptionPlugin;
module.exports.decryptFields = decryptFields;
module.exports.contextOf = contextOf;
