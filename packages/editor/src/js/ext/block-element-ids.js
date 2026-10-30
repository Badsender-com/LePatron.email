'use strict';

/**
 * The ids Mosaico gives the elements of the canvas (converter/parser.js): a
 * block's container is `ko_<type>_<n>`, and each editable text of the block is
 * `<blockId>_<path>`, the first dot of its path turned into an underscore.
 */

const BLOCK_ID = /^ko_([A-Za-z][A-Za-z0-9]*)_(\d+)$/;

const idOfPath = (path) => path.replace('.', '_');

module.exports = { BLOCK_ID, idOfPath };
