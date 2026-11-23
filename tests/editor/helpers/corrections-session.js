'use strict';

/**
 * What the tests of the spelling correction's steps share (epic #1251, ADR
 * 0011): the targets, the text fields of an email, a mocked editor over them,
 * and a session of the « corrections » family over a mocked API.
 */

const {
  createActionSession,
} = require('../../../packages/editor/src/js/ext/ai-panel/action-session');

const FIELD_TARGET = {
  kind: 'blockField',
  blockId: 'ko_textBlock_3',
  blockType: 'textBlock',
  field: 'titleText',
};
const BLOCK_TARGET = {
  kind: 'block',
  blockId: 'ko_textBlock_3',
  blockType: 'textBlock',
};
const EMAIL = { kind: 'email' };

// The text fields of the email, as the listing of a block's text fields
// (#1253) gives them.
const FIELDS = {
  ko_textBlock_3: [
    {
      path: 'titleText',
      role: 'title',
      html: '<p>Les soldes commence demain</p>',
      hidden: false,
      sample: false,
    },
    {
      path: 'longText',
      role: 'text',
      html: '<p>Profitez de <strong>-30 %</strong> sur la colection</p>',
      hidden: false,
      sample: false,
    },
    {
      path: 'image.alt',
      role: 'alt',
      html: 'Une robe en lin bleu',
      hidden: false,
      sample: false,
    },
    {
      path: 'subtitleText',
      role: 'title',
      html: 'Sous-titre caché',
      hidden: true,
      sample: false,
    },
    {
      path: 'buttonText',
      role: 'button',
      html: 'Bouton',
      hidden: false,
      sample: true,
    },
  ],
  ko_footerBlock_9: [
    {
      path: 'legalText',
      role: 'text',
      html: 'Vous recevez cet email car vous etes inscrit.',
      hidden: false,
      sample: false,
    },
  ],
};

function fakeEditor() {
  const html = {};
  Object.entries(FIELDS).forEach(([blockId, fields]) => {
    fields.forEach((f) => {
      html[`${blockId}:${f.path}`] = f.html;
    });
  });
  const calls = [];
  return {
    html,
    calls,
    mailingId: 'm1',
    blocks: () => [
      { blockId: 'ko_textBlock_3', blockType: 'textBlock' },
      { blockId: 'ko_footerBlock_9', blockType: 'footerBlock' },
    ],
    textFieldsOf: (blockId) =>
      FIELDS[blockId].map((f) => ({
        ...f,
        html: html[`${blockId}:${f.path}`],
      })),
    readField: (blockId, path) => html[`${blockId}:${path}`],
    writeField: (blockId, path, value) => {
      calls.push(['writeField', blockId, path, value]);
      html[`${blockId}:${path}`] = value;
    },
    startMultiple: () => calls.push(['startMultiple']),
    stopMultiple: () => calls.push(['stopMultiple']),
  };
}

const fix = (field, before, after, reason = 'Orthographe') => ({
  field,
  before,
  after,
  reason,
});

// A fresh API, editor and wait for each test, and the session of an action.
function correctionsSetup() {
  const api = { generate: jest.fn() };
  const editor = fakeEditor();
  const wait = jest.fn().mockResolvedValue();
  const open = (target) =>
    createActionSession({
      action: 'correct-text',
      target,
      api,
      editor,
      wait,
    });
  return { api, editor, wait, open };
}

module.exports = {
  FIELD_TARGET,
  BLOCK_TARGET,
  EMAIL,
  FIELDS,
  fakeEditor,
  fix,
  correctionsSetup,
};
