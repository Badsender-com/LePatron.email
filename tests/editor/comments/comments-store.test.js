'use strict';

/**
 * Acceptance tests of the comments' state (ADR 0020), out of any component:
 * a controller of Knockout observables, without DOM, that the Vue panel
 * renders and the Knockout pieces of the canvas read (the rail, the block
 * tool, the quality control's "Add a comment", the counter).
 *
 * Seam: `createCommentsStore(ko, options)` over a mocked API and fake timers.
 * Comments load once at the first opening, refresh every 30 seconds while the
 * panel is open and the tab visible, and at every reopening; a refresh merges
 * by comment, so a reply or an edit under way keeps its object, and new
 * comments wait behind a pill. The target of a new comment is not the filter
 * of the list.
 *
 * Turned on by P5 (the comments' controller).
 */

const ko = require('knockout');

const REFRESH_MS = 30 * 1000;

const comment = (id, fields = {}) => ({
  _id: id,
  text: `Commentaire ${id}`,
  resolved: false,
  _parentComment: null,
  decision: null,
  severity: 'info',
  blockId: null,
  ...fields,
});

function mount({ items = [] } = {}) {
  const {
    createCommentsStore,
  } = require('../../../packages/editor/src/js/ext/comments/comments-store.js');
  const api = {
    list: jest
      .fn()
      .mockImplementation(async () => items.map((c) => ({ ...c }))),
    counts: jest.fn().mockResolvedValue({ b1: { count: 2 } }),
    unresolvedCount: jest.fn().mockResolvedValue(3),
  };
  const page = { hidden: false };
  const isOpen = ko.observable(false);
  const selection = ko.observable(null);
  const store = createCommentsStore(ko, {
    api,
    isOpen,
    selection,
    isPageHidden: () => page.hidden,
  });
  return {
    store,
    api,
    page,
    isOpen,
    selection,
    setItems: (next) => (items = next),
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.useFakeTimers('legacy'));
afterEach(() => jest.useRealTimers());

describe('the comments store (ADR 0020, P5)', () => {
  describe('loading', () => {
    it('loads the counters at start, panel closed, without the list', async () => {
      const { store, api } = mount();
      store.start();
      await settle();
      expect(api.counts).toHaveBeenCalledTimes(1);
      expect(api.list).not.toHaveBeenCalled();
      expect(store.unresolvedCount()).toBe(3);
      expect(store.counts()).toEqual({ b1: { count: 2 } });
    });

    it('loads once at the first opening, not twice from the URL', async () => {
      const { store, api, isOpen } = mount({ items: [comment('c1')] });
      store.openFromUrl();
      isOpen(true);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(1);
      expect(store.comments().map((c) => c._id)).toEqual(['c1']);
    });

    it('loads again at every reopening', async () => {
      const { api, isOpen } = mount();
      isOpen(true);
      await settle();
      isOpen(false);
      isOpen(true);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshing every 30 seconds', () => {
    it('refreshes while the panel is open, with one request per cycle', async () => {
      const { api, isOpen } = mount();
      isOpen(true);
      await settle();
      api.counts.mockClear();
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(api.counts).not.toHaveBeenCalled();
    });

    it('waits while the tab is hidden, and stops once the panel is closed', async () => {
      const { api, isOpen, page } = mount();
      isOpen(true);
      await settle();
      page.hidden = true;
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(1);

      page.hidden = false;
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(2);

      isOpen(false);
      jest.advanceTimersByTime(REFRESH_MS * 3);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('updates a comment shown in place: it keeps its identity', async () => {
      const { store, isOpen, setItems } = mount({ items: [comment('c1')] });
      isOpen(true);
      await settle();
      const shown = store.comments()[0];
      setItems([comment('c1', { text: 'modifié' })]);
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      expect(store.comments()[0]).toBe(shown);
      expect(shown.text).toBe('modifié');
    });

    it('holds new comments behind the pill until the user shows them', async () => {
      const { store, isOpen, setItems } = mount({ items: [comment('c1')] });
      isOpen(true);
      await settle();
      setItems([comment('c1'), comment('c2'), comment('c3')]);
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      expect(store.comments().map((c) => c._id)).toEqual(['c1']);
      expect(store.pendingCount()).toBe(2);

      store.showNew();
      expect(store.comments().map((c) => c._id)).toEqual(['c1', 'c2', 'c3']);
      expect(store.pendingCount()).toBe(0);
    });

    it('stops refreshing once disposed', async () => {
      const { store, api, isOpen } = mount();
      isOpen(true);
      await settle();
      jest.advanceTimersByTime(REFRESH_MS);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(2);

      store.dispose();
      jest.advanceTimersByTime(REFRESH_MS * 2);
      await settle();
      expect(api.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('counting', () => {
    it('counts the unresolved root comments, never a reply nor an approval', async () => {
      const { store, isOpen } = mount({
        items: [
          comment('c1'),
          comment('c2', { resolved: true }),
          comment('r1', { _parentComment: 'c1' }),
          comment('a1', { decision: 'approved' }),
        ],
      });
      isOpen(true);
      await settle();
      expect(store.unresolvedCount()).toBe(1);
    });

    it('counts per block, from the list, for the rail and the block tool', async () => {
      const { store, isOpen } = mount({
        items: [
          comment('c1', { blockId: 'b1', severity: 'blocking' }),
          comment('c2', { blockId: 'b1' }),
          // On the whole email: counted apart, never under a block key.
          comment('g1'),
          comment('a1', {
            blockId: 'b1',
            decision: 'approved',
            severity: 'blocking',
          }),
        ],
      });
      isOpen(true);
      await settle();
      expect(store.counts()).toEqual({
        b1: { count: 2, maxSeverity: 'blocking' },
      });
    });
  });

  describe('the target of a new comment', () => {
    it('follows the canvas selection until the user changes it', () => {
      const { store, selection } = mount();
      selection({ id: () => 'b1' });
      expect(store.target()).toBe('b1');
      store.setTarget(null);
      selection({ id: () => 'b2' });
      expect(store.target()).toBe(null);
    });

    it('is not the filter: filtering on a block leaves the target alone', () => {
      const { store } = mount();
      store.setTarget(null);
      store.filter('b1');
      expect(store.target()).toBe(null);
    });

    it('is set, not the filter, by a draft from the quality control', () => {
      const { store } = mount();
      store.draftFromQuality({
        text: 'Lien vide',
        blockId: 'b3',
        severity: 'blocking',
      });
      expect(store.target()).toBe('b3');
      expect(store.filter()).toBe(null);
      expect(store.hasDraft()).toBe(true);
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
