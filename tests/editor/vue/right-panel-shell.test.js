/**
 * @jest-environment jsdom
 */

'use strict';

// The shell of the right panels (ADR 0020): one header, body and foot, which
// « Commentaires », « Tester l'email » and « Outils IA » only fill.

const Vue = require('vue/dist/vue.common');
const {
  RightPanelShell,
} = require('../../../packages/editor/src/js/vue/components/right-panel/right-panel-shell.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

function mount(attrs = '', inner = '<p>Body</p>', data = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = new Vue({
    components: { RightPanelShell },
    data: () => ({ back: jest.fn(), close: jest.fn(), ...data }),
    template: `<right-panel-shell ref="shell" title-id="t1" title="Commentaires" close-label="Fermer le panneau" ${attrs} @back="back" @close="close">${inner}</right-panel-shell>`,
  }).$mount(el);
  return { app, root: app.$el };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the right panel shell', () => {
  it('is a dialog named by its title, which is the only text of the header', () => {
    const { root } = mount();
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('false');
    expect(root.getAttribute('aria-labelledby')).toBe('t1');
    expect(root.querySelector('#t1').textContent).toBe('Commentaires');
    expect(root.querySelector('.right-panel-shell__back')).toBeNull();
    expect(root.querySelector('.right-panel-shell__count')).toBeNull();
  });

  it('asks its panel to close, with a named button', () => {
    const { root, app } = mount();
    const close = root.querySelector('.right-panel-shell__close');
    expect(close.tagName).toBe('BUTTON');
    expect(close.getAttribute('aria-label')).toBe('Fermer le panneau');
    close.click();
    expect(app.close).toHaveBeenCalled();
  });

  it('shows a count after the title, said with its label', () => {
    const { root } = mount(':count="2" count-label="2 non résolus"');
    const count = root.querySelector('.right-panel-shell__count');
    expect(count.querySelector('[aria-hidden="true"]').textContent).toBe('2');
    expect(count.querySelector('.qc-sr-only').textContent).toBe(
      '2 non résolus'
    );
  });

  it('says the count as is when it has no label', () => {
    const { root } = mount(':count="3"');
    const count = root.querySelector('.right-panel-shell__count');
    expect(count.querySelector('.qc-sr-only').textContent).toBe('3');
  });

  it('shows a count of zero', () => {
    const { root } = mount(':count="0"');
    expect(root.querySelector('.right-panel-shell__count')).not.toBeNull();
  });

  it('goes back from a second level with a named arrow', () => {
    const { root, app } = mount('back-label="Toutes les actions"');
    const back = root.querySelector('.right-panel-shell__back');
    expect(back.getAttribute('aria-label')).toBe('Toutes les actions');
    back.click();
    expect(app.back).toHaveBeenCalled();
  });

  it('draws no foot nor nav when the panel gives none', () => {
    const { root } = mount();
    expect(root.querySelector('.right-panel-shell__body').textContent).toBe(
      'Body'
    );
    expect(root.querySelector('.right-panel-shell__footer')).toBeNull();
    expect(root.querySelector('.right-panel-shell__nav')).toBeNull();
  });

  it('places the nav above the body and the foot below it', () => {
    const { root } = mount(
      '',
      '<div slot="nav">Tabs</div><p>Body</p><button slot="footer">Envoyer</button>'
    );
    const parts = [...root.children].map((child) => child.className);
    expect(parts).toEqual([
      'right-panel-shell__header',
      'right-panel-shell__nav',
      'right-panel-shell__body',
      'right-panel-shell__footer',
    ]);
  });

  it('gives the focus to its title when asked', async () => {
    const { app } = mount();
    app.$refs.shell.focusTitle();
    await app.$nextTick();
    expect(document.activeElement.id).toBe('t1');
  });
});
