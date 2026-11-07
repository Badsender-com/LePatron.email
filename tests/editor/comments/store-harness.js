'use strict';

// Shared by the comments store's tests: a store over a mocked API.

const ko = require('knockout');

const REFRESH_MS = 30 * 1000;

const comment = (id, fields = {}) => ({
  _id: id,
  text: `Commentaire ${id}`,
  resolved: false,
  _parentComment: null,
  decision: null,
  severity: 'info',
  blockId: null,
  ...fields,
});

function mount({ items = [] } = {}) {
  const {
    createCommentsStore,
  } = require('../../../packages/editor/src/js/ext/comments/comments-store.js');
  const api = {
    list: jest
      .fn()
      .mockImplementation(async () => items.map((c) => ({ ...c }))),
    counts: jest.fn().mockResolvedValue({ b1: { count: 2 } }),
    unresolvedCount: jest.fn().mockResolvedValue(3),
  };
  const page = { hidden: false };
  const isOpen = ko.observable(false);
  const selection = ko.observable(null);
  const store = createCommentsStore(ko, {
    api,
    isOpen,
    selection,
    isPageHidden: () => page.hidden,
  });
  return {
    store,
    api,
    page,
    isOpen,
    selection,
    setItems: (next) => (items = next),
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

module.exports = { REFRESH_MS, comment, mount, settle };
