'use strict';

/**
 * Reads and writes an email's preheader inside the Mosaico `data` payload.
 *
 * The preheader is NOT a mailing field. Every client template already declares a
 * `preheaderText` property — the name is constant and the template guide
 * documents it — but its location in `data` differs:
 *
 *   - at the root:  `data.preheaderText`
 *       (Badsender News, Challenges confidentiel, Badsender and comments)
 *   - in the block: `data.preheaderBlock.preheaderText`
 *       (Clarins ×2, Shine, Ouest France)
 *
 * Storing a second copy on the mailing would leave two competing values, only one
 * of which reaches the sent email — the editor already shows this property under
 * "Template Options". So we edit the existing property, wherever it lives.
 *
 * A template with no preheader at all is left untouched: we do not invent a
 * property a template never declared. Callers get `written: false` and can hide
 * the field.
 */

const PREHEADER_PROPERTY = 'preheaderText';
const PREHEADER_BLOCK = 'preheaderBlock';

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (object, key) =>
  isObject(object) && Object.prototype.hasOwnProperty.call(object, key);

/**
 * Where the preheader property lives in this payload, or null when the template
 * does not declare one.
 *
 * @param {Object} data mailing.data
 * @returns {'root'|'block'|null}
 */
function findPreheaderLocation(data) {
  if (hasOwn(data, PREHEADER_PROPERTY)) return 'root';
  if (isObject(data) && hasOwn(data[PREHEADER_BLOCK], PREHEADER_PROPERTY)) {
    return 'block';
  }
  return null;
}

/**
 * @param {Object} data mailing.data
 * @returns {string|null} the current preheader, or null when the template has none
 */
function readPreheader(data) {
  const location = findPreheaderLocation(data);
  if (location === 'root') {
    const value = data[PREHEADER_PROPERTY];
    return typeof value === 'string' ? value : null;
  }
  if (location === 'block') {
    const value = data[PREHEADER_BLOCK][PREHEADER_PROPERTY];
    return typeof value === 'string' ? value : null;
  }
  return null;
}

/**
 * Write the preheader where the template declares it.
 *
 * Mutates `data` in place — the caller holds a Mongoose Mixed field and must call
 * `markModified('data')` anyway, so returning a copy would only invite mistakes.
 *
 * @param {Object} data mailing.data
 * @param {string} value the new preheader ('' clears it)
 * @returns {{ data: Object, written: boolean, location: 'root'|'block'|null }}
 */
function writePreheader(data, value) {
  const location = findPreheaderLocation(data);
  if (location === null) {
    return { data, written: false, location: null };
  }

  const text = typeof value === 'string' ? value : '';
  if (location === 'root') {
    data[PREHEADER_PROPERTY] = text;
  } else {
    data[PREHEADER_BLOCK][PREHEADER_PROPERTY] = text;
  }

  return { data, written: true, location };
}

module.exports = {
  readPreheader,
  writePreheader,
  findPreheaderLocation,
  PREHEADER_PROPERTY,
  PREHEADER_BLOCK,
};
