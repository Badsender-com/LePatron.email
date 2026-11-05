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
  return { rail, state, scroller, listen };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe.skip('the comment markers rail (ADR 0020, P4)', () => {
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
