'use strict';

/**
 * One name for a block of the email, wherever the editor shows it: the
 * comments, the quality control and the AI tools say « Cover · bloc 2 », as
 * the settings title it « Cover » and the left bar lists « Cover
 * (largecoverBlock) ».
 *
 * - its name: the one the template gives its type, in the user's language,
 *   or its type made readable when the template gives none;
 * - its place among the blocks of the email, which tells apart two blocks of
 *   one type; a fixed block of the template (a header, a footer) has no
 *   place, its name alone.
 */

const ko = require('knockout');
const { formatBlockName } = require('./comments-utils.js');

const unwrap = ko.utils.unwrapObservable;

// A fixed block's id holds its type: ko_<type>_<n>.
const FIXED_BLOCK_ID = /^ko_(.+)_\d+$/;

function blockTypeName(viewModel, type) {
  if (!type) return '';
  const names = (viewModel && viewModel.templateBlockNames) || {};
  const name = names[type];
  if (name && typeof viewModel.ut === 'function') {
    return viewModel.ut('template', name);
  }
  return formatBlockName(type);
}

function emailBlocks(viewModel) {
  try {
    return viewModel.content().mainBlocks().blocks() || [];
  } catch (e) {
    // A template without a main container.
    return [];
  }
}

function typeOf(block) {
  let type = unwrap(block._type || block.type);
  if (typeof type === 'object' && type !== null) type = type.name || type.label;
  return type;
}

function blockLabel(viewModel, blockId) {
  if (!blockId) return '';
  const blocks = emailBlocks(viewModel);
  const place = blocks.findIndex(function (block) {
    return unwrap(unwrap(block).id) === blockId;
  });
  if (place === -1) {
    const match = FIXED_BLOCK_ID.exec(blockId);
    return match ? blockTypeName(viewModel, match[1]) : blockId;
  }
  const name = blockTypeName(viewModel, typeOf(unwrap(blocks[place])));
  return `${name} · ${viewModel.t('comments-block-place', {
    place: place + 1,
  })}`;
}

module.exports = { blockTypeName, blockLabel };
