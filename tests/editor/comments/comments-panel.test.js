/**
 * @jest-environment jsdom
 */

'use strict';

// The comments panel in Vue, on the editor's comments (ADR 0020, P8): what
// it shows comes from the store, what it writes goes through the view model.

const $ = require('jquery');
const ko = require('knockout');
const Vue = require('vue/dist/vue.common');
const commentsLoader = require('../../../packages/editor/src/js/ext/badsender-comments.js');
const {
  CommentsPanel,
} = require('../../../packages/editor/src/js/vue/components/comments/comments-panel.js');
const {
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');
const { fakeViewModel } = require('../quality/fake-view-model');

Vue.config.productionTip = false;
Vue.config.devtools = false;

// Timers are fake (the store refreshes on an interval): promises only.
const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

let clock = 0;
const comment = (fields = {}) => ({
  _id: `c${++clock}`,
  _parentComment: null,
  resolved: false,
  decision: null,
  severity: 'info',
  category: 'general',
  blockId: null,
  text: `Comment ${clock}`,
  createdAt: new Date(2026, 10, 5, 10, clock).toISOString(),
  authorName: 'Ana',
  _author: { id: 'u1' },
  ...fields,
});

// The server: the list, then whatever is posted, as it would answer it.
function server(items) {
  const posted = [];
  jest.spyOn($, 'ajax').mockImplementation((options) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.data);
      posted.push(body);
      options.success(
        comment({ ...body, _parentComment: body.parentCommentId || null })
      );
    } else if (options.method === 'PATCH') {
      const id = /comments\/([^/]+)/.exec(options.url)[1];
      const found = items.find((c) => c._id === id) || {};
      options.success({ ...found, resolved: /\/resolve$/.test(options.url) });
    } else if (/\/comments$/.test(options.url)) {
      options.success({ items });
    } else if (/counts$|unresolved-count$/.test(options.url)) {
      options.success(/counts$/.test(options.url) ? {} : { count: 0 });
    }
    return $.Deferred().promise();
  });
  return posted;
}

async function open({ items = [], role = 'reviewer' } = {}) {
  const posted = server(items);
  const vm = fakeViewModel({ blocks: [{ id: 'b1', type: 'heroBlock' }] });
  vm.selectedBlock = ko.observable(null);
  vm.currentUser = ko.observable({
    id: 'u1',
    capabilities: capabilitiesOfRole(role),
  });
  vm.managesCurrentGroup = () => false;
  vm.notifier = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
  commentsLoader({ metadata: { id: 'm1', groupId: 'g1' } })(vm);
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = new Vue({
    render: (h) => h(CommentsPanel, { props: { vm } }),
  }).$mount(el);
  vm.showComments(true);
  await flush();
  await Vue.nextTick();
  return { vm, root: app.$el, posted, app };
}

beforeEach(() => {
  clock = 0;
  jest.useFakeTimers('legacy');
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('the comments panel', () => {
  it('shows the comments of the email, and counts the unresolved in its header', async () => {
    const { root } = await open({
      items: [comment(), comment({ resolved: true })],
    });
    expect(root.querySelector('#comments-panel-title').textContent).toBe(
      'comments-title'
    );
    expect(
      root.querySelector('.right-panel-shell__count').textContent
    ).toContain('1');
    expect(root.querySelectorAll('.comment-item')).toHaveLength(1);
  });

  it('says « Validé » in its header once the email is approved', async () => {
    const { root } = await open({ items: [comment({ decision: 'approved' })] });
    expect(
      root.querySelector('.comments-panel__approved').textContent
    ).toContain('comments-approved-badge');
    expect(root.querySelector('.right-panel-shell__count')).toBeNull();
  });

  it('posts the draft on its target, once, and empties it', async () => {
    const { vm, root, posted } = await open();
    vm.commentsStore.draftText('Fix the price');
    vm.commentsStore.setTarget('b1');
    await Vue.nextTick();
    const form = root.querySelector('.comment-composer');
    form.dispatchEvent(new Event('submit'));
    form.dispatchEvent(new Event('submit'));
    await flush();
    expect(posted).toEqual([
      expect.objectContaining({
        text: 'Fix the price',
        blockId: 'b1',
        decision: null,
      }),
    ]);
    expect(vm.commentsStore.draftText()).toBe('');
  });

  it('approves the email for a reviewer, never over an open blocking comment', async () => {
    const { root, posted } = await open({
      items: [comment({ severity: 'blocking' })],
    });
    const approve = root.querySelector('.comment-composer__approve');
    expect(approve.getAttribute('aria-disabled')).toBe('true');
    approve.click();
    await flush();
    expect(posted).toEqual([]);
  });

  it('offers no second approval once the email is approved', async () => {
    const { root } = await open({ items: [comment({ decision: 'approved' })] });
    expect(root.querySelector('.comment-composer__approve')).toBeNull();
  });

  it('approves with neither type nor priority, whatever the draft says', async () => {
    const { vm, root, posted } = await open();
    vm.commentsStore.draftSeverity('blocking');
    vm.commentsStore.draftCategory('design');
    await Vue.nextTick();
    root.querySelector('.comment-composer__approve').click();
    await flush();
    expect(posted).toEqual([
      expect.objectContaining({
        decision: 'approved',
        category: 'general',
        severity: 'info',
      }),
    ]);
  });

  it('keeps the focus in the panel when a comment leaves its place', async () => {
    const { root } = await open({ items: [comment()] });
    root.querySelector('[aria-label="comments-resolve"]').click();
    await flush();
    await Vue.nextTick();
    await Vue.nextTick();
    expect(document.activeElement.id).toBe('comments-panel-title');
  });

  it('offers no approval to a writer', async () => {
    const { root } = await open({ role: 'writer' });
    expect(root.querySelector('.comment-composer__approve')).toBeNull();
  });

  it('replies under a comment, on its block, as a plain info', async () => {
    const parent = comment({ blockId: 'b1', severity: 'blocking' });
    const { root, posted } = await open({ items: [parent] });
    root.querySelector('[aria-label="comments-reply"]').click();
    await Vue.nextTick();
    const textarea = root.querySelector('.comment-inline-form textarea');
    textarea.value = 'Done';
    textarea.dispatchEvent(new Event('input'));
    await Vue.nextTick();
    root
      .querySelector('.comment-inline-form')
      .dispatchEvent(new Event('submit'));
    await flush();
    expect(posted).toEqual([
      expect.objectContaining({
        text: 'Done',
        parentCommentId: parent._id,
        blockId: 'b1',
        severity: 'info',
      }),
    ]);
    await Vue.nextTick();
    expect(root.querySelector('.comment-inline-form')).toBeNull();
  });

  it('edits a comment with its mentions shown by name, and stores them as before', async () => {
    const own = comment({ text: 'Ask @[Tom Roe](ab12)' });
    const { root } = await open({ items: [own] });
    $.ajax.mockClear();
    root.querySelector('[aria-label="comments-edit"]').click();
    await Vue.nextTick();
    const textarea = root.querySelector('.comment-inline-form textarea');
    expect(textarea.value).toBe('Ask @Tom Roe');
    textarea.value = 'Ask @Tom Roe again';
    textarea.dispatchEvent(new Event('input'));
    await Vue.nextTick();
    root
      .querySelector('.comment-inline-form')
      .dispatchEvent(new Event('submit'));
    const patch = $.ajax.mock.calls.find(
      ([options]) => options.method === 'PATCH'
    );
    expect(JSON.parse(patch[0].data)).toEqual({
      text: 'Ask @[Tom Roe](ab12) again',
    });
  });

  it('reads one block from its filter, and keeps the target apart (decision 7)', async () => {
    const { vm, root } = await open({
      items: [comment({ blockId: 'b1' }), comment()],
    });
    vm.selectedBlock({ id: () => 'b1' });
    await Vue.nextTick();
    const [, blockChip] = root.querySelectorAll('.comments-filter__chip');
    blockChip.click();
    await Vue.nextTick();
    expect(root.querySelectorAll('.comment-item')).toHaveLength(1);
    vm.selectedBlock(null);
    await Vue.nextTick();
    expect(vm.commentsStore.filter()).toBe('b1');
    expect(vm.commentsStore.target()).toBeNull();
  });

  it('closes through the right panel', async () => {
    const { vm, root } = await open();
    root.querySelector('.right-panel-shell__close').click();
    expect(vm.showComments()).toBe(false);
  });
});
