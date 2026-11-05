'use strict';

// What the comments panel writes (ADR 0020): each request, then the store,
// then a word to the user.

const {
  createCommentsActions,
} = require('../../../packages/editor/src/js/ext/comments/comments-actions.js');

function setup({
  answer = 'success',
  response = {},
  confirm = () => true,
} = {}) {
  const calls = [];
  const notifier = { success: jest.fn(), error: jest.fn() };
  const store = {
    upsert: jest.fn(),
    remove: jest.fn(),
    start: jest.fn(),
    listLoaded: () => true,
  };
  const actions = createCommentsActions({
    ajax: (options) => {
      calls.push(options);
      options[answer](
        answer === 'success' ? response : { responseJSON: response }
      );
    },
    store,
    apiBaseUrl: '/api',
    mailingId: 'm1',
    notifier: () => notifier,
    t: (key) => key,
    confirm,
  });
  return { actions, calls, notifier, store };
}

describe('the comments actions', () => {
  it('posts a comment, which the store takes as the server answered it', async () => {
    const { actions, calls, store, notifier } = setup({
      response: { _id: 'c1' },
    });
    await actions.create({ text: 'Hi' });
    expect(calls[0]).toMatchObject({
      url: '/api/mailings/m1/comments',
      method: 'POST',
    });
    expect(JSON.parse(calls[0].data)).toEqual({ text: 'Hi' });
    expect(store.upsert).toHaveBeenCalledWith({ _id: 'c1' });
    expect(notifier.success).toHaveBeenCalledWith('comments-created');
  });

  it('says why the server refused an approval, and rejects', async () => {
    const { actions, notifier, store } = setup({
      answer: 'error',
      response: { message: 'COMMENT_APPROVAL_BLOCKED' },
    });
    await expect(actions.create({ decision: 'approved' })).rejects.toBeTruthy();
    expect(notifier.error).toHaveBeenCalledWith('comments-approve-blocked');
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('asks before deleting, and deletes nothing when told no', async () => {
    const { actions, calls } = setup({ confirm: () => false });
    expect(await actions.remove({ _id: 'c1' })).toBe(false);
    expect(calls).toEqual([]);
  });

  it('says a withdrawn approval as such', async () => {
    const confirm = jest.fn(() => true);
    const { actions, notifier, store } = setup({ confirm });
    await actions.remove({ _id: 'a1', decision: 'approved' });
    expect(confirm).toHaveBeenCalledWith('comments-withdraw-confirm');
    expect(store.remove).toHaveBeenCalledWith('a1');
    expect(notifier.success).toHaveBeenCalledWith('comments-withdrawn');
  });

  it('puts an id into a URL only escaped', async () => {
    const { actions, calls } = setup();
    await actions.resolve({ _id: '../x?y' });
    expect(calls[0].url).toBe('/api/comments/..%2Fx%3Fy/resolve');
  });
});
