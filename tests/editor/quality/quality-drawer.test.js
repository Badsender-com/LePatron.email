/**
 * @jest-environment jsdom
 */

'use strict';

// The "Send a test" tab loads the saved lists of addresses when it is shown.
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

const apps = [];
let changeContent = () => {};

async function mountDrawer(result, { ignoreUrl = '/api/m1/ignores' } = {}) {
  const vm = fakeViewModel({ blocks: [{ id: 'b1', type: 'heroBlock' }] });
  vm.selectBlock = jest.fn();
  vm.notifier = { warning: jest.fn(), error: jest.fn() };
  vm.metadata.url = { qualityIgnores: ignoreUrl };
  installQualityReview(vm, ko, {
    run: () => result,
    defer: (fn) => fn(),
    persist: (_url, change) =>
      Promise.resolve(change.ignored ? [change.fingerprint] : []),
    watchContent: (_vm, _ko, onChange) => {
      changeContent = onChange;
      return () => {};
    },
  });
  document.body.innerHTML =
    '<div id="root"></div><button id="quality-toggle"></button>' +
    '<div class="editable" data-block-id="b1"></div>';
  const app = new Vue({
    render: (h) => h(QualityDrawer, { props: { vm } }),
  }).$mount('#root');
  apps.push(app);
  await Vue.nextTick();
  return { vm, app, el: app.$el };
}

const buttonNamed = (el, text) =>
  Array.from(el.querySelectorAll('.qc-row__actions button')).find(
    (b) => b.textContent.trim() === text
  );

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  apps.splice(0).forEach((app) => app.$destroy());
  delete window.pwned;
  jest.useRealTimers();
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
    expect(groups).toEqual(['quality-group-errors', 'quality-group-passed']);
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

  it('wires each group button to the region it folds, named with its count', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();

    const toggle = el.querySelector('.qc-group--error .qc-group__toggle');
    const region = el.querySelector('#' + toggle.getAttribute('aria-controls'));
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-labelledby')).toBe(toggle.id);
    expect(region.querySelector('.qc-row')).not.toBeNull();
    expect(
      el
        .querySelector('.qc-group--error .qc-group__count')
        .getAttribute('aria-hidden')
    ).toBe('true');
    expect(toggle.querySelector('.qc-sr-only').textContent).toBe('1 errors');
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

  it('shows a check that could not run at once, and does not call the email clean', async () => {
    const { vm, el } = await mountDrawer({
      findings: [],
      checks: [
        { ...sizeCheck },
        { ruleId: 'x', titleKey: 'Images', status: 'error' },
      ],
    });
    vm.quality.run();
    await Vue.nextTick();

    expect(el.querySelector('.qc-drawer__clean')).toBeNull();
    expect(el.querySelector('.qc-group--not-run')).not.toBeNull();
    expect(el.textContent).toContain('This check could not run');
    expect(el.querySelector('.qc-pill--not-run').textContent).toContain('1');
    expect(el.querySelector('[aria-live]').textContent).toBe(
      '1 checks not run'
    );
  });

  it('lists a cancelled server check as such', async () => {
    const { vm, el } = await mountDrawer({
      findings: [],
      checks: [
        { ruleId: 'broken-links', titleKey: 'Links', status: 'cancelled' },
      ],
    });
    vm.quality.run();
    await Vue.nextTick();
    expect(el.textContent).toContain('This check was cancelled');
  });

  it('expands a row and takes the user to its block, highlighted', async () => {
    jest.useFakeTimers();
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();

    const head = el.querySelector('.qc-row__head');
    expect(head.hasAttribute('aria-controls')).toBe(false);
    head.click();
    await Vue.nextTick();
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(
      document.getElementById(head.getAttribute('aria-controls'))
    ).not.toBeNull();

    buttonNamed(el, 'Go to block').click();
    expect(vm.selectBlock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
      true
    );
    jest.advanceTimersByTime(100);
    const block = document.querySelector('[data-block-id="b1"]');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(block.classList.contains('qc-highlight--error')).toBe(true);
  });

  it('warns when the block is in the model but not on the canvas', async () => {
    jest.useFakeTimers();
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();
    document.querySelector('[data-block-id="b1"]').remove();

    el.querySelector('.qc-row__head').click();
    await Vue.nextTick();
    buttonNamed(el, 'Go to block').click();
    jest.advanceTimersByTime(100);
    expect(vm.notifier.warning).toHaveBeenCalledWith(
      'The block could not be shown'
    );
  });

  it('celebrates a clean email, counting its checks at an absolute time', async () => {
    const { vm, el } = await mountDrawer({
      findings: [],
      checks: [{ ...sizeCheck }, { ...sizeCheck, ruleId: 'links' }],
    });
    vm.quality.run();
    await Vue.nextTick();

    expect(el.querySelector('.qc-drawer__clean-title').textContent).toBe(
      'All checks passed'
    );
    expect(el.querySelector('.qc-drawer__clean-text').textContent).toMatch(
      /2 of 2 checks · \d\d:\d\d/
    );
    expect(el.querySelector('.qc-drawer__summary')).toBeNull();
    expect(el.querySelector('[aria-live]').textContent).toBe(
      'All checks passed'
    );
  });

  it('announces only what was found, never the zeros', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [{ ...sizeCheck }],
    });
    vm.quality.run();
    await Vue.nextTick();
    expect(el.querySelector('[aria-live]').textContent).toBe('1 errors');
  });

  it('says when the results predate the last changes, and offers to re-run', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();
    expect(el.querySelector('.qc-stale')).toBeNull();

    changeContent();
    await Vue.nextTick();
    const banner = el.querySelector('.qc-stale');
    expect(banner.textContent).toContain(
      'The results date from before your last changes'
    );
    // The results stay readable meanwhile.
    expect(el.querySelector('.qc-row')).not.toBeNull();

    banner.querySelector('button').click();
    await Vue.nextTick();
    expect(el.querySelector('.qc-stale')).toBeNull();
  });

  it('takes the user from the results to the "Send a test" tab, with the focus', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();

    el.querySelector('.qc-drawer__footer .qc-button--cta').click();
    await Vue.nextTick();
    await Vue.nextTick();

    expect(vm.quality.tab()).toBe('send');
    const sendTab = el.querySelector('#qc-tab-send');
    expect(sendTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(sendTab);
    expect(el.querySelector('#qc-tabpanel-send').style.display).toBe('');
    expect(el.querySelector('#qc-tabpanel-checks').style.display).toBe('none');

    el.querySelector('.qc-notice .qc-link-button').click();
    await Vue.nextTick();
    await Vue.nextTick();
    expect(document.activeElement).toBe(el.querySelector('#qc-tab-checks'));
  });

  it('moves between tabs with the arrow keys, looping, focus following', async () => {
    const { vm, el } = await mountDrawer({ findings: [], checks: [] });
    const arrow = (key) =>
      el
        .querySelector('.qc-tabs')
        .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    arrow('ArrowRight');
    await Vue.nextTick();
    expect(vm.quality.tab()).toBe('send');
    expect(document.activeElement).toBe(el.querySelector('#qc-tab-send'));
    arrow('ArrowRight');
    await Vue.nextTick();
    expect(vm.quality.tab()).toBe('checks');
    arrow('ArrowLeft');
    await Vue.nextTick();
    expect(vm.quality.tab()).toBe('send');
    expect(document.activeElement).toBe(el.querySelector('#qc-tab-send'));
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
    buttonNamed(el, 'quality-action-ignore').click();
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
    expect(el.querySelector('.qc-undo')).toBeNull();
  });

  it('drops the undo bar once the finding is released by hand', async () => {
    const { vm, el } = await mountDrawer({
      findings: [linkFinding],
      checks: [],
    });
    vm.quality.run();
    await Vue.nextTick();
    el.querySelector('.qc-row__head').click();
    await Vue.nextTick();
    buttonNamed(el, 'quality-action-ignore').click();
    await Vue.nextTick();

    el.querySelector('.qc-group--ignored .qc-group__toggle').click();
    await Vue.nextTick();
    // The row keeps its id across groups, so it is still the expanded one.
    expect(
      el
        .querySelector('.qc-group--ignored .qc-row__head')
        .getAttribute('aria-expanded')
    ).toBe('true');
    buttonNamed(el, 'Stop ignoring').click();
    await Vue.nextTick();

    expect(vm.quality.ignored()).toEqual([]);
    expect(el.querySelector('.qc-undo')).toBeNull();
  });

  it('hides "Ignore" when the choice could not be stored', async () => {
    const { vm, el } = await mountDrawer(
      { findings: [linkFinding], checks: [] },
      { ignoreUrl: null }
    );
    vm.quality.run();
    await Vue.nextTick();
    el.querySelector('.qc-row__head').click();
    await Vue.nextTick();
    expect(buttonNamed(el, 'quality-action-ignore')).toBeUndefined();
    expect(buttonNamed(el, 'Go to block')).not.toBeUndefined();
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
    buttonNamed(el, 'Add comment').click();

    expect(vm.createCommentFromQc).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'b1',
        severity: 'blocking',
        category: 'content',
      })
    );
  });

  it('comments on the whole email when the block was deleted since', async () => {
    const { vm, el } = await mountDrawer({
      findings: [{ ...linkFinding, blockId: 'gone' }],
      checks: [],
    });
    vm.createCommentFromQc = jest.fn();
    vm.quality.run();
    await Vue.nextTick();

    el.querySelector('.qc-row__head').click();
    await Vue.nextTick();
    buttonNamed(el, 'Add comment').click();

    expect(vm.notifier.warning).toHaveBeenCalledWith('comments-block-deleted');
    expect(vm.createCommentFromQc).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: null })
    );
  });

  it('tells apart the server refusing too many checks from a failure', async () => {
    const { vm, el } = await mountDrawer({ findings: [], checks: [] });
    vm.quality.run();
    vm.quality.remoteError('too-frequent');
    vm.quality.remoteStatus('error');
    await Vue.nextTick();
    expect(el.querySelector('.qc-remote--error').textContent).toContain(
      'Too many checks in a short time'
    );
  });

  it('closes on Escape', async () => {
    const { vm, el } = await mountDrawer({ findings: [], checks: [] });
    vm.showQuality(true);
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(vm.showQuality()).toBe(false);
  });

  it('lets go of its subscriptions when destroyed', async () => {
    const { vm, app } = await mountDrawer({ findings: [], checks: [] });
    const drawer = app.$children[0];
    expect(drawer.subscriptions.length).toBeGreaterThan(0);
    app.$destroy();
    apps.splice(0);
    const before = drawer.status;
    vm.quality.status('running');
    expect(drawer.status).toBe(before);
  });
});
