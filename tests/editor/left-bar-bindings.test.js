/**
 * @jest-environment jsdom
 */

'use strict';

// The tabs of the left bar, bound by Knockout as the editor binds them:
// the focus stays on a pressed tab, the arrows move along a list, a
// read-only user has none, and the hidden lists keep Mosaico's order.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const leftBar = require('../../packages/editor/src/js/ext/left-bar.js');

const toolbox = fs.readFileSync(
  path.join(
    __dirname,
    '../../packages/editor/src/tmpl-badsender/toolbox.tmpl.html'
  ),
  'utf8'
);
// The tabs, from the template: the part before Mosaico's own.
const nav = toolbox.slice(0, toolbox.indexOf('<div id="tooltabs"'));

function bind({ readOnly = false } = {}) {
  const vm = {
    showGallery: ko.observable(false),
    selectedTool: ko.observable(0),
    selectedImageTab: ko.observable(0),
    blocksActiveTab: ko.observable('TEMPLATE_BLOCKS'),
    blockDefs: ko.observableArray([]),
    isReadOnly: ko.observable(readOnly),
    t: (key) => key,
  };
  leftBar(vm);
  const root = document.createElement('div');
  root.innerHTML = nav;
  document.body.appendChild(root);
  ko.applyBindings(vm, root);
  return { vm, root };
}

const shownSubTabs = (root) =>
  [...root.querySelectorAll('.left-bar-subtabs')].find(
    (group) => group.style.display !== 'none'
  );

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the bound tabs of the left bar', () => {
  it('keeps the focus on a pressed sub-tab', () => {
    const { root, vm } = bind();
    vm.showLeftBarTab('settings');
    const styles = shownSubTabs(root).querySelectorAll('button')[1];
    styles.focus();
    styles.click();
    expect(vm.selectedTool()).toBe(2);
    expect(document.activeElement).toBe(styles);
    expect(styles.getAttribute('aria-selected')).toBe('true');
  });

  it('moves along a list with the arrows, one tab stop per list', () => {
    const { root, vm } = bind();
    const tabs = root.querySelectorAll('.left-bar-segmented button');
    expect([...tabs].map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    tabs[0].focus();
    tabs[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(vm.leftBarTab()).toBe('images');
    expect(document.activeElement).toBe(tabs[1]);
    tabs[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true })
    );
    expect(vm.leftBarTab()).toBe('settings');
    expect(tabs[2].getAttribute('aria-controls')).toBe('toolcontents');
  });

  it('shows the sub-tabs of the open tab only', () => {
    const { root, vm } = bind();
    vm.showLeftBarTab('images');
    expect(shownSubTabs(root).textContent).toContain('gallery-mailing');
  });

  it('shows no tabs to a read-only user', () => {
    const { root } = bind({ readOnly: true });
    expect(root.querySelector('.left-bar-nav')).toBeNull();
  });
});

describe('the hidden lists the tabs drive', () => {
  const root = document.createElement('div');
  root.innerHTML = toolbox;

  it('keep the order of selectedTool: blocks, content, styles', () => {
    const hrefs = [...root.querySelectorAll('.tooltabs__list a')].map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toEqual(['#toolblocks', '#toolcontents', '#toolstyles']);
  });

  it('keep the order of selectedImageTab: the email’s, then the template’s', () => {
    const hrefs = [...root.querySelectorAll('#toolimagestab > ul a')].map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toEqual(['#toolimagesgallery', '#toolimagesgallerytemplate']);
  });
});
