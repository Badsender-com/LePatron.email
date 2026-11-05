/**
 * @jest-environment jsdom
 */

'use strict';

// Writing a comment, in Vue (ADR 0020, boards v3-comments-c1 to c5).

const Vue = require('vue/dist/vue.common');
const {
  CommentComposer,
} = require('../../../packages/editor/src/js/vue/components/comments/comment-composer.js');
const {
  CommentInlineForm,
} = require('../../../packages/editor/src/js/vue/components/comments/comment-inline-form.js');
const {
  CommentsMenu,
} = require('../../../packages/editor/src/js/vue/components/comments/comments-menu.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const t = (key, params = {}) =>
  Object.keys(params).reduce((s, k) => `${s} ${params[k]}`, key);

const USERS = [
  { _id: 'u1', name: 'Ana Lee', email: 'ana@example.com' },
  { _id: 'u2', name: 'Tom Roe', email: 'tom@example.com' },
];

function mount(component, props, eventNames) {
  const events = [];
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = new Vue({
    render: (h) =>
      h(component, {
        props,
        ref: 'it',
        on: Object.fromEntries(
          eventNames.map((name) => [name, (p) => events.push([name, p])])
        ),
      }),
  }).$mount(el);
  return { app, root: app.$el, events, it: app.$refs.it };
}

const COMPOSER_EVENTS = [
  'input',
  'mention',
  'target',
  'category',
  'severity',
  'submit',
  'approve',
];

const composer = (props = {}) =>
  mount(
    CommentComposer,
    { t, labelOf: (id) => `Block ${id}`, users: USERS, ...props },
    COMPOSER_EVENTS
  );

const key = (el, name) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the comment form', () => {
  it('names its target, the whole email by default', () => {
    const { root } = composer();
    expect(
      root.querySelector('.comment-composer__target').textContent
    ).toContain('comments-whole-email');
  });

  it('offers the whole email and the block selected, and says how the target follows', async () => {
    const { root, events } = composer({
      target: 'b1',
      selected: { id: 'b1', label: 'Cover' },
    });
    root.querySelector('.comment-composer__target button').click();
    await Vue.nextTick();
    const options = [...root.querySelectorAll('[role="option"]')];
    expect(
      options.map((o) => o.textContent.trim().replace(/\s+/g, ' '))
    ).toEqual([
      'comments-whole-email comments-context-global',
      'Cover comments-target-selected',
    ]);
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(root.textContent).toContain('comments-target-note');
    options[0].click();
    expect(events).toEqual([['target', null]]);
  });

  it('keeps a target that is not the block selected, as the quality control sets it', async () => {
    const { root } = composer({ target: 'b9', selected: null });
    root.querySelector('.comment-composer__target button').click();
    await Vue.nextTick();
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(2);
  });

  it('chooses the type and the priority', async () => {
    const { root, events } = composer();
    const [, type, priority] = root.querySelectorAll('.comments-menu__button');
    type.click();
    await Vue.nextTick();
    root.querySelectorAll('[role="option"]')[1].click();
    priority.click();
    await Vue.nextTick();
    root.querySelectorAll('[role="option"]')[2].click();
    expect(events).toEqual([
      ['category', 'design'],
      ['severity', 'blocking'],
    ]);
  });

  it('adds the comment, once while it is on its way', () => {
    const { root, events, app } = composer({ text: 'Hi' });
    root.dispatchEvent(new Event('submit'));
    expect(events).toEqual([['submit', undefined]]);
    app.$destroy();
    const busy = composer({ text: 'Hi', busy: true });
    busy.root.dispatchEvent(new Event('submit'));
    expect(busy.events).toEqual([]);
    expect(busy.root.querySelector('button[type="submit"]').disabled).toBe(
      true
    );
  });

  it('adds on the type and priority line for whom may not approve (board c1)', () => {
    const { root } = composer({ text: 'Hi' });
    expect(
      root.querySelector('.comment-composer__row button[type="submit"]')
    ).not.toBeNull();
    const approver = composer({ text: 'Hi', canApprove: true });
    expect(
      approver.root.querySelector(
        '.comment-composer__actions button[type="submit"]'
      )
    ).not.toBeNull();
  });

  it("offers « Approuver l'email » only to whom may approve", () => {
    expect(
      composer().root.querySelector('.comment-composer__approve')
    ).toBeNull();
    const { root, events } = composer({ canApprove: true });
    root.querySelector('.comment-composer__approve').click();
    expect(events).toEqual([['approve', undefined]]);
  });

  it('disables approving while a blocking comment is open, with the reason read from the button', () => {
    const { root, events } = composer({
      canApprove: true,
      approveBlocked: true,
    });
    const button = root.querySelector('.comment-composer__approve');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.click();
    expect(events).toEqual([]);
    const reason = root.querySelector(
      `#${button.getAttribute('aria-describedby')}`
    );
    expect(reason.textContent).toContain('comments-approve-blocked');
  });

  it('adds nothing without text', () => {
    const { root, events } = composer({ text: '  ' });
    expect(root.querySelector('button[type="submit"]').disabled).toBe(true);
    root.dispatchEvent(new Event('submit'));
    expect(events).toEqual([]);
  });
});

describe('a menu of the form', () => {
  const menu = () =>
    mount(
      CommentsMenu,
      {
        label: 'Type',
        value: 'b',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ],
      },
      ['input']
    );

  it('opens on the chosen option and moves with the arrows', async () => {
    const { root, events } = menu();
    const button = root.querySelector('button');
    key(button, 'ArrowDown');
    await Vue.nextTick();
    await Vue.nextTick();
    expect(document.activeElement.textContent.trim()).toBe('B');
    key(document.activeElement, 'ArrowDown');
    key(document.activeElement, 'Enter');
    expect(events).toEqual([['input', 'c']]);
  });

  it('closes on Escape without letting the panel close', async () => {
    const { root } = menu();
    const panelEscape = jest.fn();
    document.body.addEventListener('keydown', panelEscape);
    root.querySelector('button').click();
    await Vue.nextTick();
    key(root.querySelector('[role="option"]'), 'Escape');
    await Vue.nextTick();
    expect(root.querySelector('[role="listbox"]')).toBeNull();
    expect(panelEscape).not.toHaveBeenCalled();
    document.body.removeEventListener('keydown', panelEscape);
  });
});

describe('mentions', () => {
  const type = async (textarea, value) => {
    textarea.value = value;
    textarea.setSelectionRange(value.length, value.length);
    textarea.dispatchEvent(new Event('input'));
    await Vue.nextTick();
  };

  it('suggests the users after « @ », and tells the panel the one chosen', async () => {
    const mentions = [];
    const el = document.createElement('div');
    document.body.appendChild(el);
    // The panel holds the text, as the store does.
    const app = new Vue({
      components: { CommentComposer },
      data: () => ({ text: '', users: USERS }),
      methods: {
        t,
        labelOf: (id) => id,
        mention: (m) => mentions.push(m),
      },
      template:
        '<comment-composer :text="text" :users="users" :t="t" :label-of="labelOf" @input="text = $event" @mention="mention"></comment-composer>',
    }).$mount(el);
    const textarea = app.$el.querySelector('textarea');
    await type(textarea, 'Hello @to');
    const options = app.$el.querySelectorAll('.mention-textarea__option');
    expect([...options].map((o) => o.textContent)).toEqual([
      expect.stringContaining('Tom Roe'),
    ]);
    key(textarea, 'Enter');
    await Vue.nextTick();
    expect(mentions).toEqual([
      { name: 'Tom Roe', userId: 'u2', displayText: '@Tom Roe' },
    ]);
    expect(app.text).toBe('Hello @Tom Roe ');
    expect(textarea.value).toBe('Hello @Tom Roe ');
  });

  it('suggests no one in the middle of an address', async () => {
    const { root } = composer();
    await type(root.querySelector('textarea'), 'write to ana@to');
    expect(root.querySelector('.mention-textarea__list').style.display).toBe(
      'none'
    );
  });

  it('inserts nothing when the caret left the mention, and never doubles the text', async () => {
    const { root, events } = composer();
    const textarea = root.querySelector('textarea');
    await type(textarea, 'Hello @to');
    // The caret goes back to the start, with no new input.
    textarea.setSelectionRange(0, 0);
    key(textarea, 'Enter');
    expect(events.filter(([name]) => name === 'mention')).toEqual([]);
    expect(events.filter(([name]) => name === 'input')).toEqual([
      ['input', 'Hello @to'],
    ]);
  });

  it('closes the suggestions on Escape, the panel staying open', async () => {
    const { root } = composer();
    const textarea = root.querySelector('textarea');
    await type(textarea, '@');
    const panelEscape = jest.fn();
    document.body.addEventListener('keydown', panelEscape);
    key(textarea, 'Escape');
    await Vue.nextTick();
    expect(root.querySelector('.mention-textarea__list').style.display).toBe(
      'none'
    );
    expect(panelEscape).not.toHaveBeenCalled();
    document.body.removeEventListener('keydown', panelEscape);
  });
});

describe('a reply or an edit in the thread', () => {
  const form = (props = {}) =>
    mount(
      CommentInlineForm,
      { t, label: 'Reply', submitLabel: 'Add', users: USERS, ...props },
      ['input', 'cancel', 'submit']
    );

  it('takes the focus, and cancels on Escape without closing the panel', () => {
    const { root, events } = form();
    expect(document.activeElement).toBe(root.querySelector('textarea'));
    const panelEscape = jest.fn();
    document.body.addEventListener('keydown', panelEscape);
    key(root.querySelector('textarea'), 'Escape');
    expect(events).toEqual([['cancel', undefined]]);
    expect(panelEscape).not.toHaveBeenCalled();
    document.body.removeEventListener('keydown', panelEscape);
  });

  it('submits once while on its way', () => {
    const { root, events } = form({ busy: true });
    root.dispatchEvent(new Event('submit'));
    expect(events).toEqual([]);
  });
});
