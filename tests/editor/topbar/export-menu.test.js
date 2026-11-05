/**
 * @jest-environment jsdom
 */

'use strict';

// The menu of « Exporter » in the top bar: a disclosure the button opens
// and closes, that Escape and the focus leaving close.

const ko = require('knockout');
const {
  createExportMenu,
} = require('../../../packages/editor/src/js/ext/topbar/export-menu.js');

function setUp() {
  document.body.innerHTML = `
    <form id="menu"><button id="trigger" type="button">Export</button>
      <aside><a id="item" href="#">ZIP</a></aside></form>
    <button id="outside" type="button">Elsewhere</button>`;
  const menu = createExportMenu(ko);
  const $ = (id) => document.getElementById(id);
  return { menu, $ };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the export menu', () => {
  it('opens and closes from its button', () => {
    const { menu, $ } = setUp();
    menu.toggle(null, { currentTarget: $('trigger') });
    expect(menu.open()).toBe(true);
    menu.toggle(null, { currentTarget: $('trigger') });
    expect(menu.open()).toBe(false);
  });

  it('closes on Escape and gives the focus back to its button', () => {
    const { menu, $ } = setUp();
    menu.toggle(null, { currentTarget: $('trigger') });
    $('item').focus();
    const event = { key: 'Escape', stopPropagation: jest.fn() };
    expect(menu.onKeydown(null, event)).toBe(false);
    expect(menu.open()).toBe(false);
    expect(document.activeElement).toBe($('trigger'));
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('lets Escape go on while it is closed, and other keys always', () => {
    const { menu, $ } = setUp();
    expect(menu.onKeydown(null, { key: 'Escape' })).toBe(true);
    menu.toggle(null, { currentTarget: $('trigger') });
    expect(menu.onKeydown(null, { key: 'ArrowDown' })).toBe(true);
    expect(menu.open()).toBe(true);
  });

  it('stays open while the focus moves inside it, and closes when it leaves', () => {
    const { menu, $ } = setUp();
    menu.toggle(null, { currentTarget: $('trigger') });
    menu.onFocusout(null, {
      currentTarget: $('menu'),
      relatedTarget: $('item'),
    });
    expect(menu.open()).toBe(true);
    menu.onFocusout(null, {
      currentTarget: $('menu'),
      relatedTarget: $('outside'),
    });
    expect(menu.open()).toBe(false);
  });

  it('closes when a way out is chosen', () => {
    const { menu, $ } = setUp();
    menu.toggle(null, { currentTarget: $('trigger') });
    menu.close();
    expect(menu.open()).toBe(false);
  });
});
