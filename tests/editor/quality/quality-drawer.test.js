/**
 * @jest-environment jsdom
 */

'use strict';

const ko = require('knockout');
const Vue = require('vue/dist/vue.common');
const {
  QualityDrawer,
} = require('../../../packages/editor/src/js/vue/components/quality-drawer/quality-drawer.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const { fakeViewModel } = require('./fake-view-model');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const linkFinding = {
  ruleId: 'unfilled-links',
  category: 'content',
  titleKey: 'Links',
  severity: 'error',
  messageKey: 'Link not filled in: __label__',
  params: { label: '<img src="x" onerror="window.pwned = 1">' },
  blockId: 'b1',
  blockLabel: 'Hero',
  fingerprint: 'unfilled-links|b1|-|x',
};
const sizeCheck = {
  ruleId: 'html-size',
  category: 'technical',
  titleKey: 'Email weight',
  status: 'passed',
  passKey: 'Weighs __size__ KB',
  passParams: { size: 40 },
};

async function mountDrawer(result) {
  const vm = fakeViewModel({ blocks: [{ id: 'b1', type: 'heroBlock' }] });
  vm.selectBlock = jest.fn();
  vm.notifier = { warning: jest.fn() };
  installQualityReview(vm, ko, {
    run: () => result,
    defer: (fn) => fn(),
  });
  document.body.innerHTML =
    '<div id="root"></div><button id="quality-toggle"></button>';
  const app = new Vue({
    render: (h) => h(QualityDrawer, { props: { vm } }),
  }).$mount('#root');
  await Vue.nextTick();
  return { vm, app, el: app.$el };
}

afterEach(() => {
  delete window.pwned;
});

describe('QualityDrawer', () => {
  it('offers to run the checks before the first run', async () => {
    const { el } = await mountDrawer({ findings: [], checks: [] });
    expect(el.querySelector('.qc-drawer__empty')).not.toBeNull();
  });

  it('groups results by severity, errors first, passed checks last', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [
        { ...sizeCheck },
        { ruleId: 'unfilled-links', status: 'failed' },
      ],
    });
    vm.quality.run();
    await Vue.nextTick();

    const groups = Array.from(el.querySelectorAll('.qc-group__label')).map(
      (node) => node.textContent
    );
    expect(groups).toEqual(['Errors', 'Passed']);
    expect(el.querySelector('.qc-row__block').textContent).toContain('Hero');
    expect(el.textContent).toContain('Weighs 40 KB');
  });

  it("prints the email's own content as text, never as markup", async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();

    const desc = el.querySelector('.qc-row__desc');
    expect(desc.textContent).toContain('<img src="x"');
    expect(desc.querySelector('img')).toBeNull();
    expect(window.pwned).toBeUndefined();
  });

  it('shows a check that could not run without counting it as passed', async () => {
    const { vm, el } = await mountDrawer({
      findings: [],
      checks: [{ ruleId: 'x', titleKey: 'Images', status: 'error' }],
    });
    vm.quality.run();
    await Vue.nextTick();

    expect(el.textContent).toContain('This check could not run');
    expect(el.querySelector('.qc-group__label').textContent).toBe('Infos');
  });

  it('expands a row and takes the user to its block', async () => {
    jest.useFakeTimers();
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();

    el.querySelector('.qc-row__head').click();
    await Vue.nextTick();
    expect(
      el.querySelector('.qc-row__head').getAttribute('aria-expanded')
    ).toBe('true');

    el.querySelector('.qc-row__actions button').click();
    expect(vm.selectBlock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
      true
    );
    jest.useRealTimers();
  });

  it('celebrates a clean email, counting its checks', async () => {
    const { vm, el } = await mountDrawer({
      findings: [],
      checks: [{ ...sizeCheck }, { ...sizeCheck, ruleId: 'links' }],
    });
    vm.quality.run();
    await Vue.nextTick();

    expect(el.querySelector('.qc-drawer__clean-title').textContent).toBe(
      'All checks passed'
    );
    expect(el.querySelector('.qc-drawer__clean-text').textContent).toContain(
      '2 of 2 checks'
    );
    expect(el.querySelector('.qc-drawer__summary')).toBeNull();
  });

  it('closes on Escape', async () => {
    const { vm, el } = await mountDrawer({ findings: [], checks: [] });
    vm.showQuality(true);
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(vm.showQuality()).toBe(false);
  });
});
