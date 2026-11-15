/**
 * @jest-environment jsdom
 */

'use strict';

// The saved-block list tells a composed block from a template block (ADR 0027):
// only the composed one reopens in the Block Builder, and that is the one
// difference a user needs to see. Both origins stay in one list, in one order.
//
// The entries are drawn by Knockout from the toolbox template, so that is what
// is rendered here: the list's own fragment, bound to two entries. The custom
// bindings it uses (drag, tooltips, buttons) are inert here — what is checked
// is what the list shows, not how it is dragged.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const TOOLBOX = path.join(
  __dirname,
  '../../../packages/editor/src/tmpl-badsender/toolbox.tmpl.html'
);
const LIST_BINDING = 'foreach: personalizedBlocks()';

// The bindings of the editor the fragment uses, as no-ops.
['extdraggable', 'withProperties', 'tooltips', 'button'].forEach((name) => {
  ko.bindingHandlers[name] = ko.bindingHandlers[name] || { init() {} };
});

/** The list's fragment of the toolbox template: the element that repeats. */
function listFragment() {
  const holder = document.createElement('div');
  holder.innerHTML = fs.readFileSync(TOOLBOX, 'utf8');
  const list = Array.from(holder.querySelectorAll('[data-bind]')).find((el) =>
    el.getAttribute('data-bind').includes(LIST_BINDING)
  );
  return list.cloneNode(true);
}

const entry = (name, type) => ({
  type,
  id: '',
  blockInformation: {
    _id: `id-${name}`,
    name,
    category: 'Divers',
    userDetails: { name: 'Camille' },
  },
});

function renderList(entries) {
  const list = listFragment();
  document.body.innerHTML = '';
  document.body.appendChild(list);
  ko.applyBindings(
    {
      personalizedBlocks: ko.observableArray(entries),
      t: (key, params) =>
        params && params.name !== undefined ? String(params.name) : key,
      addBlock: () => false,
      deleteBlock: () => false,
      editBlock: () => false,
      managesCurrentGroup: () => false,
      dragging: ko.observable(false),
    },
    list
  );
  return Array.from(list.children);
}

afterEach(() => {
  document.body.innerHTML = '';
});

// Turned on by #1567 (the saved-block list tells a composed block from a
// template block)
describe.skip('the saved-block list tells a composed block from a template block', () => {
  const MARK = '[data-saved-block-origin="composed"]';

  it('marks a composed entry', () => {
    const [composed] = renderList([
      entry('Deux colonnes', 'blockBuilderBlock'),
    ]);

    const mark = composed.querySelector(MARK);
    expect(mark).not.toBeNull();
    expect(mark.textContent.trim()).toBe('saved-block-origin-composed');
  });

  it('leaves a template entry unmarked', () => {
    const [template] = renderList([entry('Bandeau', 'heroBlock')]);

    expect(template.querySelector(MARK)).toBeNull();
  });

  it('keeps both origins in one list, in the order given', () => {
    const items = renderList([
      entry('Deux colonnes', 'blockBuilderBlock'),
      entry('Bandeau', 'heroBlock'),
    ]);

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Deux colonnes'),
      expect.stringContaining('Bandeau'),
    ]);
  });
});
