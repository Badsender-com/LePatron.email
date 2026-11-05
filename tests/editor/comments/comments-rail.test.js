/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * Acceptance tests of the comment markers rail (ADR 0020), out of the comments
 * panel: it stays in Knockout, in the canvas, and the panel moves to Vue.
 *
 * Seam: `createCommentsRail(ko, options)`, a module of its own with a
 * `dispose`. It reads the counts per block and the comment target from the
 * comments' state, places a marker beside each block that has unresolved
 * comments, and frees its scroll listener when the editor goes.
 *
 * Turned on by P4 (the rail, extracted).
 */

const ko = require('knockout');

const SCROLLER_ID = 'main-wysiwyg-area';

function canvas(blocks) {
  document.body.innerHTML = `<div id="${SCROLLER_ID}">${blocks
    .map((id) => `<div class="editable" data-block-id="${id}"></div>`)
    .join('')}</div>`;
  blocks.forEach((id, index) => {
    const element = document.querySelector(`[data-block-id="${id}"]`);
    element.getBoundingClientRect = () => ({
      top: 100 + index * 200,
      height: 100,
    });
  });
  return document.getElementById(SCROLLER_ID);
}

function mount({ counts = {}, blocks = [] } = {}) {
  // Loaded inside each test: the module does not exist before P4.
  const {
    createCommentsRail,
  } = require('../../../packages/editor/src/js/ext/comments/comments-rail.js');
  const scroller = canvas(blocks);
  const listen = jest.spyOn(scroller, 'addEventListener');
  const state = {
    counts: ko.observable(counts),
    target: ko.observable(null),
    openForBlock: jest.fn(),
  };
  const rail = createCommentsRail(ko, {
    counts: state.counts,
    target: state.target,
    openForBlock: state.openForBlock,
    labelOf: (blockId) => `Bloc ${blockId}`,
    scroller: () => scroller,
  });
  rail.update();
  mounted.push(rail);
  return { rail, state, scroller, listen };
}

const mounted = [];
afterEach(() => {
  mounted.splice(0).forEach((rail) => rail.dispose());
  document.body.innerHTML = '';
});

describe('the comment markers rail (ADR 0020, P4)', () => {
  it('shows a marker per block with unresolved comments, in the order of the email', () => {
    const { rail } = mount({
      blocks: ['b1', 'b2', 'b3'],
      counts: {
        b3: { count: 1, maxSeverity: 'info' },
        b1: { count: 2, maxSeverity: 'blocking' },
        b2: { count: 0, maxSeverity: 'info' },
      },
    });
    expect(
      rail.markers().map((m) => [m.blockId, m.count, m.maxSeverity])
    ).toEqual([
      ['b1', 2, 'blocking'],
      ['b3', 1, 'info'],
    ]);
  });

  it('leaves out the comments on the whole email, and hides when only they remain', () => {
    const { rail } = mount({ blocks: ['b1'], counts: { null: { count: 3 } } });
    expect(rail.markers()).toEqual([]);
    expect(rail.visible()).toBe(false);
  });

  it('marks active the marker of the comment target, not of the filter', () => {
    const { rail, state } = mount({
      blocks: ['b1', 'b2'],
      counts: { b1: { count: 1 }, b2: { count: 1 } },
    });
    state.target('b2');
    expect(rail.markers().map((m) => [m.blockId, m.active])).toEqual([
      ['b1', false],
      ['b2', true],
    ]);
  });

  it('opens the comments on the block of a marker', () => {
    const { rail, state } = mount({
      blocks: ['b1'],
      counts: { b1: { count: 1 } },
    });
    rail.open(rail.markers()[0]);
    expect(state.openForBlock).toHaveBeenCalledWith('b1');
  });

  it('follows the counts as they change', () => {
    const { rail, state } = mount({
      blocks: ['b1', 'b2'],
      counts: { b1: { count: 1 } },
    });
    state.counts({
      b1: { count: 1 },
      b2: { count: 4, maxSeverity: 'important' },
    });
    expect(rail.markers().map((m) => m.blockId)).toEqual(['b1', 'b2']);
  });

  it('stops listening to the canvas scroll once disposed', () => {
    const { rail, scroller, listen } = mount({
      blocks: ['b1'],
      counts: { b1: { count: 1 } },
    });
    const [, onScroll] = listen.mock.calls.find(([type]) => type === 'scroll');
    const remove = jest.spyOn(scroller, 'removeEventListener');
    rail.dispose();
    expect(remove).toHaveBeenCalledWith('scroll', onScroll);
  });
});

describe('the comment markers rail in the editor (ADR 0020, P4)', () => {
  const $ = require('jquery');
  const commentsLoader = require('../../../packages/editor/src/js/ext/badsender-comments.js');
  const { fakeViewModel } = require('../quality/fake-view-model');

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function editor() {
    jest.useFakeTimers();
    jest.spyOn($, 'ajax').mockImplementation(() => $.Deferred().promise());
    const vm = fakeViewModel({ blocks: [{ id: 'b1', type: 'heroBlock' }] });
    vm.selectedBlock = ko.observable(null);
    const plugin = commentsLoader({ metadata: { id: 'm1', groupId: 'g1' } })(
      vm
    );
    return { vm, plugin };
  }

  it('marks active the block of a new comment, and names the block', async () => {
    const scroller = canvas(['b1']);
    const { vm } = editor();
    const comment = (id) => ({
      _id: id,
      blockId: 'b1',
      severity: 'important',
      resolved: false,
      _parentComment: null,
    });
    $.ajax.mockImplementation((options) => {
      if (/\/comments$/.test(options.url)) {
        options.success({ items: [comment('c1'), comment('c2')] });
      }
      return $.Deferred().promise();
    });
    await vm.loadComments();
    vm.commentsRail.update();
    // The target, not the filter (decision 7b).
    vm.selectedBlockForComments('b1');
    expect(vm.commentsRail.markers()[0].active).toBe(false);
    vm.commentsStore.setTarget('b1');
    expect(vm.commentsRail.markers()).toEqual([
      expect.objectContaining({ blockId: 'b1', count: 2, active: true }),
    ]);
    expect(vm.commentsRail.markers()[0].label).toBe('Hero');
    expect(scroller.querySelector('[data-block-id="b1"]')).not.toBeNull();
  });

  it('lets go of the canvas when the editor goes', () => {
    const scroller = canvas(['b1']);
    const remove = jest.spyOn(scroller, 'removeEventListener');
    const { vm, plugin } = editor();
    vm.commentsRail.update();
    plugin.dispose();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});

describe('the comment markers rail, after the review (ADR 0020, P4)', () => {
  it('keeps its markers from a scroll to the next, so a focused one stays', () => {
    const { rail } = mount({ blocks: ['b1'], counts: { b1: { count: 1 } } });
    const first = rail.markers()[0];
    rail.update();
    expect(rail.markers()[0]).toBe(first);
  });

  it('finds a block by its attribute, whatever its id holds', () => {
    const odd = 'a"] , *';
    const { rail } = mount({ blocks: ['b1'], counts: { [odd]: { count: 1 } } });
    expect(() => rail.update()).not.toThrow();
    expect(rail.markers()).toEqual([]);
  });
});

describe('the place of the rail (ADR 0020, P4)', () => {
  function placed({ emailRight, canvasLeft, canvasWidth }) {
    const { rail, scroller } = mount({
      blocks: ['b1'],
      counts: { b1: { count: 1 } },
    });
    const email = document.createElement('replacedbody');
    email.getBoundingClientRect = () => ({ right: emailRight });
    scroller.appendChild(email);
    scroller.getBoundingClientRect = () => ({ left: canvasLeft });
    Object.defineProperty(scroller, 'clientWidth', { value: canvasWidth });
    rail.update();
    return rail.left();
  }

  it('sits beside the email', () => {
    expect(
      placed({ emailRight: 1100, canvasLeft: 400, canvasWidth: 1000 })
    ).toBe(1108);
  });

  it('stays inside the canvas when the email reaches its edge', () => {
    expect(
      placed({ emailRight: 1390, canvasLeft: 400, canvasWidth: 1000 })
    ).toBe(1348);
  });

  it('lets go of the window too when disposed', () => {
    const remove = jest.spyOn(window, 'removeEventListener');
    const { rail } = mount({ blocks: ['b1'], counts: { b1: { count: 1 } } });
    rail.dispose();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('transitionend', expect.any(Function));
    remove.mockRestore();
  });
});
