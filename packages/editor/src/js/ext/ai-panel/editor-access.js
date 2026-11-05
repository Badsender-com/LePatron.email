'use strict';

const _ = require('lodash');
const ko = require('knockout');
const { getSubject, canWriteSubject, setSubject } = require('../email-subject');
const { extractEmailCopy } = require('../text-generation/email-copy');
const {
  readPreheader,
  canWritePreheader,
  writePreheader,
} = require('../email-preheader');
const { listTextFields } = require('../block-text-fields');
const { idOfPath } = require('../block-element-ids');
const { getBlockDefault } = require('../quality/ownership');
const {
  injectBlockTranslations,
} = require('../../utils/block-content-extractor');
const { goToBlock, findBlockById } = require('../block-navigation');
const {
  getBlockLabelWithNumber,
  formatBlockName,
} = require('../comments-utils');

const BLOCK_ID = /^ko_([A-Za-z][A-Za-z0-9]*)_(\d+)$/;

const unwrap = ko.utils.unwrapObservable;

const hasId = (block, blockId) => {
  const value = unwrap(block);
  return Boolean(value) && typeof value === 'object' && unwrap(value.id) === blockId;
};

/**
 * A block of the email by its id, as the observable its fields are written
 * to: a block of a container (`xBlocks`, converter/parser.js), or one of the
 * template's fixed blocks, declared at the root of the content (a header, a
 * footer).
 */
function blockById(viewModel, blockId) {
  const content = viewModel.content() || {};
  for (const key of Object.keys(content)) {
    if (hasId(content[key], blockId)) return content[key];
    if (/Blocks$/.test(key)) {
      const container = unwrap(content[key]);
      const blocks = (container && unwrap(container.blocks)) || [];
      const found = blocks.find((block) => hasId(block, blockId));
      if (found) return found;
    }
  }
  return null;
}

// Whether the rendering hides an element: by itself or by an ancestor, up to
// its block.
function isHiddenIn(element, block) {
  const view = element.ownerDocument.defaultView;
  for (let node = element; node && node !== block; node = node.parentElement) {
    if (node.hidden) return true;
    const style = view.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
  }
  return false;
}

/**
 * Whether the canvas hides a field. Each editable text is rendered with the id
 * `<blockId>_<path>`, the first dot an underscore: a text field the canvas does
 * not render at all is hidden too. An alternative text has no element of its
 * own: it shows with its block.
 */
function hiddenInCanvas(blockId) {
  const block = document.getElementById(blockId);
  return (path, role) => {
    if (!block) return true;
    if (role === 'alt') return isHiddenIn(block, null);
    const element = document.getElementById(`${blockId}_${idOfPath(path)}`);
    return !element || isHiddenIn(element, block);
  };
}

/**
 * What the AI actions read from and write into the email being edited: the
 * `editor` of an action session, and the context of the action registry.
 * Everything is read when asked, not once: the subject is typed in a form, the
 * template decides whether there is a preheader.
 */
function createEditorAccess(viewModel) {
  // A subject the user generated and copied, for an email whose subject lives
  // in the sending platform: the preheader builds on it all the same.
  let rememberedSubject = null;
  const knownSubject = () => getSubject(viewModel) || rememberedSubject || '';

  return {
    get mailingId() {
      return viewModel.metadata.id;
    },
    get canApplySubject() {
      return canWriteSubject(viewModel);
    },
    get canApplyPreheader() {
      return canWritePreheader(viewModel);
    },
    // The text on screen, the sample values of the template left out.
    emailCopy() {
      const defs = ko.toJS(viewModel.blockDefs) || [];
      const sampleFor = (blockType, field) => {
        const def = defs.find((d) => d.type === blockType);
        return def && typeof def[field] === 'string' ? def[field] : undefined;
      };
      const canvas = document.getElementById('main-wysiwyg-area') || document;
      return extractEmailCopy(canvas, { sampleFor });
    },
    getSubject: () => getSubject(viewModel) || '',
    knownSubject,
    rememberSubject: (value) => {
      rememberedSubject = value;
    },
    setSubject: (value) => setSubject(viewModel, value),
    // A preheader switched off is no current text: it shows nowhere.
    getPreheader: () =>
      canWritePreheader(viewModel) ? readPreheader(viewModel).value : '',
    setPreheader: (value) => writePreheader(viewModel, value),
    // The blocks of the email in reading order, as the canvas renders them.
    blocks() {
      const canvas = document.getElementById('main-wysiwyg-area') || document;
      return Array.from(canvas.querySelectorAll('[id^="ko_"]'))
        .map((element) => BLOCK_ID.exec(element.id))
        .filter(Boolean)
        .map(([blockId, blockType]) => ({ blockId, blockType }));
    },
    // How the quality drawer and the comments name a block: « Texte 2 ».
    blockLabel(blockId) {
      let blocks = [];
      try {
        blocks = viewModel.content().mainBlocks().blocks();
      } catch (e) {
        // A template without a main container.
      }
      // A fixed block of the template (a header, a footer) is named by type.
      const match = BLOCK_ID.exec(blockId);
      return (
        getBlockLabelWithNumber(blocks, blockId) ||
        (match ? formatBlockName(match[1]) : blockId)
      );
    },
    // Only the blocks of the email can be reached, not the template's fixed
    // ones (a header, a footer).
    canGoToBlock: (blockId) => Boolean(findBlockById(viewModel, blockId)),
    goToBlock: (blockId) => goToBlock(viewModel, blockId),
    // The text fields of a block, with their HTML, as the rendering shows them.
    textFieldsOf(blockId) {
      const block = ko.toJS(blockById(viewModel, blockId)) || {};
      const blockDef = getBlockDefault(ko.toJS(viewModel.blockDefs), block.type);
      return listTextFields(block, {
        blockDef,
        isHidden: hiddenInCanvas(blockId),
      }).map((field) => ({ ...field, html: field.value }));
    },
    readField: (blockId, path) =>
      _.get(ko.toJS(blockById(viewModel, blockId)), path),
    writeField: (blockId, path, html) =>
      injectBlockTranslations(blockById(viewModel, blockId), { [path]: html }),
    startMultiple: () => viewModel.startMultiple(),
    stopMultiple: () => viewModel.stopMultiple(),
    undo: () => viewModel.undo.execute(),
    redo: () => viewModel.redo.execute(),
    // Called after each step of the undo stack: an edit, an undo, a redo.
    onHistory(callback) {
      const subscriptions = [viewModel.undoCount, viewModel.redoCount]
        .filter(ko.isSubscribable)
        .map((count) => count.subscribe(() => callback()));
      return () => subscriptions.forEach((s) => s.dispose());
    },
    // The context the action registry decides from.
    context() {
      const textGeneration = Boolean(
        viewModel.metadata.hasTextGenerationFeature
      );
      return {
        textGeneration,
        hasSubject: Boolean(knownSubject().trim()),
        hasSubjectField: canWriteSubject(viewModel),
        // The whole content is read only when an action may need it.
        hasPreheaderField: textGeneration && canWritePreheader(viewModel),
      };
    },
  };
}

module.exports = { createEditorAccess };
