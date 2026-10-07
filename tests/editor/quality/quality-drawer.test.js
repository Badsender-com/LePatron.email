/**
 * @jest-environment jsdom
 */

'use strict';

// The "Send a test" tab loads the saved lists of addresses when it mounts.
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { items: [] } })),
  post: jest.fn(() => Promise.resolve({})),
}));

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
  });

  it('folds the passed checks and the infos, and unfolds them on demand', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [{ ...sizeCheck }],
    });
    vm.quality.run();
    await Vue.nextTick();

    const toggles = el.querySelectorAll('.qc-group__toggle');
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('false');
    expect(el.textContent).not.toContain('Weighs 40 KB');

    toggles[1].click();
    await Vue.nextTick();
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
    expect(el.textContent).toContain('Weighs 40 KB');

    // A re-run keeps the groups as the user left them.
    vm.quality.run();
    await Vue.nextTick();
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

    expect(el.querySelector('.qc-group__label').textContent).toBe('Infos');
    el.querySelector('.qc-group__toggle').click();
    await Vue.nextTick();
    expect(el.textContent).toContain('This check could not run');
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

  it('takes the user from the results to the "Send a test" tab', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();

    el.querySelector('.qc-drawer__footer .qc-button--cta').click();
    await Vue.nextTick();

    expect(vm.quality.tab()).toBe('send');
    expect(el.querySelector('#qc-tab-send').getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(el.querySelector('#qc-tabpanel-send').style.display).toBe('');
    expect(el.querySelector('#qc-tabpanel-checks').style.display).toBe('none');
  });

  it('moves between tabs with the arrow keys', async () => {
    const { vm, el } = await mountDrawer({ findings: [], checks: [] });
    el.querySelector('.qc-tabs').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await Vue.nextTick();
    expect(vm.quality.tab()).toBe('send');
  });

  it('ignores a finding, keeps it apart, and undoes it', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();

    el.querySelector('.qc-row__head').click();
    await Vue.nextTick();
    const ignore = Array.from(
      el.querySelectorAll('.qc-row__actions button')
    ).find((b) => b.textContent.trim() === 'Ignore');
    ignore.click();
    await Vue.nextTick();

    expect(vm.quality.ignored()).toEqual([linkFinding.fingerprint]);
    expect(
      el.querySelector('.qc-group--ignored .qc-group__count').textContent
    ).toBe('1');
    expect(el.querySelector('.qc-undo')).not.toBeNull();

    el.querySelector('.qc-undo .qc-link-button').click();
    await Vue.nextTick();
    expect(vm.quality.ignored()).toEqual([]);
    expect(el.querySelector('.qc-group--ignored')).toBeNull();
  });

  it('turns a finding into a comment draft', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.createCommentFromQc = jest.fn();
    vm.quality.run();
    await Vue.nextTick();

    el.querySelector('.qc-row__head').click();
    await Vue.nextTick();
    Array.from(el.querySelectorAll('.qc-row__actions button'))
      .find((b) => b.textContent.trim() === 'Add comment')
      .click();

    expect(vm.createCommentFromQc).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'b1',
        severity: 'blocking',
        category: 'content',
      })
    );
  });

  // Escape and focus are the right panel's, for every panel alike: see
  // tests/editor/right-panel-binding.test.js.
});
