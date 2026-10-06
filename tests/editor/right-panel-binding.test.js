/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * The shell behaviours every right panel gets from the `rightPanel` binding
 * (ext/right-panel.js): shown or hidden and inert, Escape to close, focus moved
 * in on open and given back to its toggle on close.
 */

const ko = require('knockout');
const {
  installRightPanel,
} = require('../../packages/editor/src/js/ext/right-panel');

function mount() {
  document.body.innerHTML = `
    <button id="toggle" aria-controls="toolquality">Tester</button>
    <div id="toolquality" class="slidebar right-panel" data-bind="rightPanel: 'quality'">
      <button id="close">Fermer</button>
    </div>`;
  const vm = {};
  installRightPanel(vm, ko);
  ko.applyBindings(vm, document.body);
  return { vm, panel: document.getElementById('toolquality') };
}

afterEach(() => {
  ko.cleanNode(document.body);
  jest.useRealTimers();
});

describe('the right panel binding', () => {
  it('hides a closed panel and makes it inert', () => {
    const { panel } = mount();
    expect(panel.classList.contains('hidden')).toBe(true);
    expect(panel.hasAttribute('inert')).toBe(true);
  });

  it('shows the open panel, no longer inert, and moves the focus in', () => {
    jest.useFakeTimers();
    const { vm, panel } = mount();
    vm.rightPanel.show('quality');
    jest.runAllTimers();
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(document.activeElement.id).toBe('close');
  });

  it('closes on Escape', () => {
    const { vm, panel } = mount();
    vm.rightPanel.show('quality');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(vm.rightPanel.open()).toBeNull();
  });

  it('gives the focus back to its toggle when it closes', () => {
    jest.useFakeTimers();
    const { vm } = mount();
    vm.rightPanel.show('quality');
    jest.runAllTimers();
    vm.rightPanel.hide();
    expect(document.activeElement.id).toBe('toggle');
  });

  it('hides a panel when another one opens', () => {
    const { vm, panel } = mount();
    vm.rightPanel.show('quality');
    vm.rightPanel.show('comments');
    expect(panel.classList.contains('hidden')).toBe(true);
  });
});
