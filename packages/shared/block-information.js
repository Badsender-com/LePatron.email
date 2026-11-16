'use strict';

// `blockInformation` is what a block of an email keeps of the saved block it
// was inserted from: the palette and the save and delete modals read these
// fields, nothing else. One list, read by the editor when it builds a palette
// block (personalized-blocks-list/palette-block.js), by the server whenever
// it writes a mailing's `data`, and by
// scripts/migrate-block-information-fields.js.

const BLOCK_INFORMATION_FIELDS = Object.freeze(['_id', 'name', 'category']);
const AUTHOR_FIELD = 'userDetails';
const AUTHOR_FIELDS = Object.freeze(['name']);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const pick = (source, fields) =>
  fields.reduce((kept, field) => {
    if (has(source, field)) kept[field] = source[field];
    return kept;
  }, {});

const onlyKeys = (object, fields) =>
  Object.keys(object).every((key) => fields.includes(key));

/**
 * The kept fields of a `blockInformation`. The author is kept as
 * `{ name }` when the input has one, and left out otherwise.
 *
 * @param {Object} information a plain object
 * @returns {Object}
 */
function keepBlockInformation(information) {
  const kept = pick(information, BLOCK_INFORMATION_FIELDS);
  if (isPlainObject(information[AUTHOR_FIELD])) {
    kept[AUTHOR_FIELD] = pick(information[AUTHOR_FIELD], AUTHOR_FIELDS);
  }
  return kept;
}

/**
 * Whether `keepBlockInformation` would change this value. Anything but a
 * plain object is left as it is.
 *
 * @param {*} information
 * @returns {boolean}
 */
function needsKeeping(information) {
  if (!isPlainObject(information)) return false;
  if (!onlyKeys(information, [...BLOCK_INFORMATION_FIELDS, AUTHOR_FIELD])) {
    return true;
  }
  if (!has(information, AUTHOR_FIELD)) return false;
  const author = information[AUTHOR_FIELD];
  return !isPlainObject(author) || !onlyKeys(author, AUTHOR_FIELDS);
}

/**
 * The blocks of a Mosaico content model whose `blockInformation` holds more
 * than the kept fields. Blocks sit in containers, each a `{ blocks: [...] }`
 * at the top level of the model (`mainBlocks` by convention); only that level
 * is walked.
 *
 * @param {Object} data mailing.data
 * @returns {Array<{container: string, index: number, information: Object}>}
 */
function locateBlockInformationToKeep(data) {
  if (!isPlainObject(data)) return [];
  const found = [];
  Object.entries(data).forEach(([container, value]) => {
    if (!isPlainObject(value) || !Array.isArray(value.blocks)) return;
    value.blocks.forEach((block, index) => {
      if (isPlainObject(block) && needsKeeping(block.blockInformation)) {
        found.push({ container, index, information: block.blockInformation });
      }
    });
  });
  return found;
}

/**
 * A Mosaico content model whose blocks keep only the kept fields in their
 * `blockInformation`. The input is left as it is; it is returned unchanged
 * when nothing is to be dropped.
 *
 * @param {Object} data mailing.data
 * @returns {Object}
 */
function keepBlockInformationFields(data) {
  const found = locateBlockInformationToKeep(data);
  if (!found.length) return data;
  const kept = { ...data };
  found.forEach(({ container, index, information }) => {
    if (kept[container] === data[container]) {
      kept[container] = {
        ...data[container],
        blocks: [...data[container].blocks],
      };
    }
    kept[container].blocks[index] = {
      ...data[container].blocks[index],
      blockInformation: keepBlockInformation(information),
    };
  });
  return kept;
}

module.exports = {
  BLOCK_INFORMATION_FIELDS,
  AUTHOR_FIELD,
  AUTHOR_FIELDS,
  keepBlockInformation,
  needsKeeping,
  locateBlockInformationToKeep,
  keepBlockInformationFields,
};
