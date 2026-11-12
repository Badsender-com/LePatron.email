/**
 * @jest-environment jsdom
 */

'use strict';

// The comments list in Vue (ADR 0020, boards v3-comments-c1 to c6): it shows
// and asks; the panel carries out.

const Vue = require('vue/dist/vue.common');
const {
  CommentsList,
} = require('../../../packages/editor/src/js/vue/components/comments/comments-list.js');
const {
  CommentsFilter,
} = require('../../../packages/editor/src/js/vue/components/comments/comments-filter.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

let clock = 0;
const comment = (fields = {}) => ({
  _id: `c${++clock}`,
  _parentComment: null,
  resolved: false,
  decision: null,
  severity: 'info',
  category: 'general',
  blockId: null,
  text: 'Hello',
  createdAt: new Date(2026, 10, 5, 10, clock).toISOString(),
  authorName: `Author ${clock}`,
  ...fields,
});

const EVENTS = [
  'reply',
  'resolve',
  'unresolve',
  'edit',
  'delete',
  'go-to-block',
  'retry',
  'show-new',
  'filter',
];

const t = (key, params = {}) =>
  Object.keys(params).reduce((s, k) => `${s} ${params[k]}`, key);

function mount(props = {}, component = CommentsList) {
  const events = [];
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = new Vue({
    render: (h) =>
      h(component, {
        props: {
          t,
          formatDate: () => 'now',
          labelOf: (id) => `Block ${id}`,
          blockExists: (id) => id !== 'gone',
          can: () => false,
          status: 1,
          ...props,
        },
        on: Object.fromEntries(
          EVENTS.map((name) => [
            name,
            (payload) => events.push([name, payload]),
          ])
        ),
      }),
  }).$mount(el);
  return { app, root: app.$el, events };
}

const texts = (root, selector) =>
  [...root.querySelectorAll(selector)].map((el) =>
    el.textContent.trim().replace(/\s+/g, ' ')
  );

beforeEach(() => {
  clock = 0;
  document.body.innerHTML = '';
});

describe('the comments list', () => {
  it('shows the newest first, each on what it is on', () => {
    const old = comment({ blockId: 'b1' });
    const recent = comment();
    const { root } = mount({ comments: [old, recent] });
    expect(texts(root, '.comment-item__author')).toEqual([
      'Author 2',
      'Author 1',
    ]);
    expect(texts(root, '.comment-item__target')).toEqual([
      'comments-whole-email',
      'Block b1 · comments-go-to-block',
    ]);
  });

  it('says a block was deleted, with no way to go to it', () => {
    const { root } = mount({ comments: [comment({ blockId: 'gone' })] });
    expect(root.querySelector('.comment-item__go')).toBeNull();
    expect(root.textContent).toContain('comments-block-deleted');
  });

  it('shows a text as text, mentions by name, never as markup', () => {
    const { root } = mount({
      comments: [
        comment({ text: '<img src=x onerror=alert(1)> @[Ana](ab12)' }),
      ],
    });
    const text = root.querySelector('.comment-text');
    expect(text.querySelector('img')).toBeNull();
    expect(text.querySelector('.comment-mention').textContent).toBe('@Ana');
  });

  it('shows the priority of an open comment, red only when blocking', () => {
    const { root } = mount({
      comments: [
        comment({ severity: 'blocking' }),
        comment({ severity: 'info' }),
      ],
    });
    expect(root.querySelectorAll('.comment-badge--blocking')).toHaveLength(1);
    expect(root.querySelector('.comment-badge--info')).toBeNull();
  });

  it('shows a request for changes, a decision of older comments', () => {
    const { root } = mount({
      comments: [comment({ decision: 'changes_requested' })],
    });
    expect(root.querySelector('.comment-badge--changes').textContent).toContain(
      'comments-decision-changes-requested'
    );
  });

  it('folds the resolved comments under their count', async () => {
    const { root } = mount({
      comments: [comment({ resolved: true }), comment({ resolved: true })],
    });
    const toggle = root.querySelector('.comments-list__resolved-toggle');
    expect(toggle.textContent).toContain('comments-resolved-count 2');
    expect(root.querySelector('.comment-item')).toBeNull();
    toggle.click();
    await Vue.nextTick();
    expect(root.querySelectorAll('.comment-item')).toHaveLength(2);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('asks the panel for every action, with the comment', () => {
    const item = comment();
    const { root, events } = mount({ comments: [item], can: () => true });
    [
      'comments-reply',
      'comments-resolve',
      'comments-edit',
      'comments-delete',
    ].forEach((label) => root.querySelector(`[aria-label="${label}"]`).click());
    expect(events.map(([name]) => name)).toEqual([
      'reply',
      'resolve',
      'edit',
      'delete',
    ]);
    expect(events.every(([, payload]) => payload === item)).toBe(true);
  });

  it('offers editing and deleting only to whom may', () => {
    const { root } = mount({ comments: [comment()] });
    expect(root.querySelector('[aria-label="comments-edit"]')).toBeNull();
    expect(root.querySelector('[aria-label="comments-delete"]')).toBeNull();
  });

  it('gives a comment its replies', () => {
    const root = comment();
    const reply = comment({ _parentComment: root._id, text: 'Done' });
    const { root: el } = mount({ comments: [root, reply] });
    expect(texts(el, '.comment-reply .comment-text')).toEqual(['Done']);
  });
});

describe('an approval in the list', () => {
  it('is an event of the thread, withdrawn by whom may', () => {
    const approval = comment({ decision: 'approved', text: 'Bon pour envoi' });
    const { root, events } = mount({ comments: [approval], can: () => true });
    expect(root.querySelector('.comment-item')).toBeNull();
    expect(
      root
        .querySelector('.comment-approval__head')
        .textContent.replace(/\s+/g, ' ')
    ).toContain('Author 1 comments-approved-the-email');
    expect(root.querySelector('.comment-approval__name').textContent).toBe(
      'Author 1'
    );
    root.querySelector('.comment-approval__withdraw').click();
    expect(events).toEqual([['delete', approval]]);
  });

  it('says which comment lifted it', () => {
    const approval = comment({ decision: 'approved' });
    const after = comment();
    const { root } = mount({ comments: [approval, after] });
    expect(
      root.querySelector('.comment-approval__lifted').textContent
    ).toContain('comments-approval-lifted Author 2');
  });

  it('is lifted by a comment still held behind the pill, as the server counts it', () => {
    const approval = comment({ decision: 'approved' });
    const held = comment();
    const { root } = mount({
      comments: [approval],
      allComments: [approval, held],
      pendingCount: 1,
    });
    expect(root.querySelector('.comment-approval__lifted')).not.toBeNull();
  });

  it('shows the replies written under it', () => {
    const approval = comment({ decision: 'approved' });
    const reply = comment({ _parentComment: approval._id, text: 'Thanks' });
    const { root } = mount({ comments: [approval, reply] });
    expect(
      texts(root, '.comment-approval .comment-reply .comment-text')
    ).toEqual(['Thanks']);
  });

  it('stays out of a block filter', () => {
    const { root } = mount({
      comments: [comment({ decision: 'approved' }), comment({ blockId: 'b1' })],
      filter: 'b1',
    });
    expect(root.querySelector('.comment-approval')).toBeNull();
    expect(root.querySelectorAll('.comment-item')).toHaveLength(1);
  });
});

describe('the states of the list', () => {
  it('says it loads', () => {
    const { root } = mount({ status: 'loading' });
    expect(root.querySelector('.right-panel-state--loading')).not.toBeNull();
  });

  it('offers to retry a failed load', () => {
    const { root, events } = mount({ status: 'error' });
    root.querySelector('.right-panel-state--error button').click();
    expect(events).toEqual([['retry', undefined]]);
  });

  it('is empty at full size, compact under a filter', () => {
    expect(
      mount({ comments: [] }).root.querySelector('.right-panel-state--empty')
    ).not.toBeNull();
    expect(
      mount({ comments: [], filter: 'b1' }).root.querySelector(
        '.right-panel-state--compact'
      )
    ).not.toBeNull();
  });

  it('holds the new comments behind a pill, not as empty', () => {
    const { root, events } = mount({ comments: [], pendingCount: 2 });
    expect(root.querySelector('.right-panel-state')).toBeNull();
    root.querySelector('.comments-new-pill').click();
    expect(events).toEqual([['show-new', undefined]]);
  });
});

describe('the filter of the comments', () => {
  it('reads all, or the block selected, each with its count', () => {
    const { root, events } = mount(
      {
        filter: null,
        allCount: 3,
        block: { id: 'b1', label: 'Cover', count: 1 },
      },
      CommentsFilter
    );
    const [all, block] = root.querySelectorAll('button');
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(block.textContent.trim()).toBe('Cover · 1');
    block.click();
    expect(events).toEqual([['filter', 'b1']]);
  });

  it('says it only reads while a block is read', () => {
    const { root } = mount(
      {
        filter: 'b1',
        allCount: 3,
        block: { id: 'b1', label: 'Cover', count: 1 },
      },
      CommentsFilter
    );
    expect(root.querySelector('.comments-filter__note').textContent).toBe(
      'comments-filter-note Cover'
    );
    expect(
      mount(
        { filter: null, block: { id: 'b1', label: 'Cover', count: 1 } },
        CommentsFilter
      ).root.querySelector('.comments-filter__note')
    ).toBeNull();
  });

  it('shows « Tous » alone while no block is selected (board c1)', () => {
    const { root } = mount({ block: null }, CommentsFilter);
    expect(root.querySelectorAll('button')).toHaveLength(1);
    expect(root.querySelectorAll('.comments-filter__chip')).toHaveLength(1);
  });
});
