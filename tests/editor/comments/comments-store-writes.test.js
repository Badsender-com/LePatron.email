'use strict';

/**
 * The comments store (ADR 0020, P5): what the user changes, and the browser's
 * timers.
 */

const { comment, mount, settle, REFRESH_MS } = require('./store-harness.js');

beforeEach(() => jest.useFakeTimers('legacy'));
afterEach(() => jest.useRealTimers());

describe('the comments store, the user’s changes (ADR 0020, P5)', () => {
  describe('the user’s own changes', () => {
    it('puts a comment the server answered with in place, with its fields', () => {
      const { store } = mount();
      store.upsert({ _id: 'c1', text: 'Sur tout l’email' });
      store.upsert({ _id: 'c1', text: 'Modifié' });
      expect(store.comments()).toEqual([
        {
          _id: 'c1',
          text: 'Modifié',
          blockId: null,
          decision: null,
          _parentComment: null,
        },
      ]);
    });

    it('removes a deleted comment with its replies, held or shown', async () => {
      const { store, isOpen, setItems } = mount({ items: [comment('c1')] });
      isOpen(true);
      await settle();
      setItems([comment('c1'), comment('r1', { _parentComment: 'c1' })]);
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      store.remove('c1');
      expect(store.allComments()).toEqual([]);
    });

    it('counts a blocking comment held behind the pill', async () => {
      const { store, isOpen, setItems } = mount({ items: [comment('c1')] });
      isOpen(true);
      await settle();
      setItems([comment('c1'), comment('b1', { severity: 'blocking' })]);
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      expect(store.pendingCount()).toBe(1);
      expect(store.unresolvedCount()).toBe(2);
    });
  });
  it('calls the timers as plain functions, as a browser requires', async () => {
    jest.useRealTimers();
    const strict = jest
      .spyOn(global, 'setInterval')
      .mockImplementation(function (_fn, _ms) {
        if (this !== undefined && this !== global) {
          throw new TypeError('Illegal invocation');
        }
        return 1;
      });
    const { isOpen } = mount();
    expect(() => isOpen(true)).not.toThrow();
    strict.mockRestore();
  });
});
