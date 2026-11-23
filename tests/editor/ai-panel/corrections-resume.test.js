'use strict';

/**
 * Acceptance tests of the spelling correction (epic #1251, ADR 0011): an
 * analysis paused by the AI rate limit, stopped, resumed or started again.
 * The panel keeps the session of each action; coming back to it never lists
 * a correction twice.
 */

const {
  FIELD_TARGET,
  EMAIL,
  fix,
  withBlocks,
  NONE,
  blocksOf,
  correctionsSetup,
} = require('../helpers/corrections-session');

let api;
let editor;
let wait;
let open;

beforeEach(() => {
  ({ api, editor, wait, open } = correctionsSetup());
});

const LONG = 'Bonjour à tous. '.repeat(250);
const rateLimited = (retryAfterSeconds) => ({
  response: { status: 429, data: { retryAfterSeconds } },
});
const found = (...corrections) => ({ corrections, dropped: 0 });

describe('spelling correction: pausing, stopping and resuming', () => {
  it('pauses on the AI rate limit for the delay the server gives, then sends the refused lot alone again', async () => {
    // A field too long to be checked, and one at its sample text.
    editor.html['ko_footerBlock_9:legalText'] = 'a'.repeat(5001);
    const session = open(EMAIL);
    let during;
    wait.mockImplementation(async () => {
      const { pausedFor, resumesAt } = session.state;
      during = { pausedFor, resumesAt };
    });
    api.generate.mockRejectedValueOnce(rateLimited(40)).mockResolvedValue(NONE);
    const before = Date.now();
    await session.request();
    expect(wait).toHaveBeenCalledWith(40000);
    expect(during.pausedFor).toBe(40);
    expect(during.resumesAt).toBeGreaterThanOrEqual(before + 40000);
    expect(during.resumesAt).toBeLessThanOrEqual(Date.now() + 40000);
    expect(api.generate.mock.calls).toEqual([
      api.generate.mock.calls[0],
      api.generate.mock.calls[0],
    ]);
    expect(session.state).toEqual(
      expect.objectContaining({
        pausedFor: null,
        resumesAt: null,
        leftOut: { sample: 1 },
        tooLong: 1,
        progress: { done: 2, total: 2 },
        error: null,
      })
    );
  });

  it('stops, rather than waiting, when the rate limit holds for long', async () => {
    api.generate.mockRejectedValue(rateLimited(3600));
    const session = open(EMAIL);
    await session.request();
    expect(wait).not.toHaveBeenCalled();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.error).toBe('text-generation-error-rate-limited');
    expect(session.state.canResume).toBe(true);
  });

  it('ends a pause at once when the user stops, the paused lot not treated', async () => {
    const session = open(EMAIL);
    // A pause that would never end by itself.
    wait.mockImplementation(() => {
      session.stop();
      return new Promise(() => {});
    });
    api.generate.mockRejectedValueOnce(rateLimited(40));
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state).toEqual(
      expect.objectContaining({
        pausedFor: null,
        resumesAt: null,
        stopped: true,
        canResume: true,
        nextBlock: 0,
        progress: { done: 0, total: 2 },
      })
    );
  });

  it('resumes at the first block not treated, keeping what it found', async () => {
    withBlocks(editor, [`Il a manger. ${LONG}`, `Nous avont. ${LONG}`]);
    const session = open(EMAIL);
    api.generate
      .mockImplementationOnce(async () => {
        session.stop();
        return found(fix('text', 'a manger', 'a mangé'));
      })
      .mockResolvedValueOnce(found(fix('text', 'avont', 'avons')));
    await session.request();
    expect(session.state.canResume).toBe(true);
    await session.resume();
    expect(api.generate.mock.calls.map(blocksOf)).toEqual([
      ['ko_textBlock_1'],
      ['ko_textBlock_2'],
    ]);
    expect(session.state.corrections.map((c) => c.after)).toEqual([
      'a mangé',
      'avons',
    ]);
    expect(session.state).toEqual(
      expect.objectContaining({
        progress: { done: 2, total: 2 },
        stopped: false,
        canResume: false,
      })
    );
  });

  it('resumes after a failure of the feature', async () => {
    withBlocks(editor, [LONG, LONG]);
    api.generate
      .mockResolvedValueOnce(NONE)
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce(NONE);
    const session = open(EMAIL);
    await session.request();
    expect(session.state.error).toBe('text-generation-error-unavailable');
    expect(session.state.nextBlock).toBe(1);
    expect(session.state.canResume).toBe(true);
    await session.resume();
    expect(api.generate.mock.calls.map(blocksOf)).toEqual([
      ['ko_textBlock_1'],
      ['ko_textBlock_2'],
      ['ko_textBlock_2'],
    ]);
    expect(session.state.error).toBeNull();
    expect(session.state.canResume).toBe(false);
  });

  it('never lists a correction twice when a block in parts is sent again', async () => {
    const texts = Array.from({ length: 45 }, (_, i) => `Texte ${i}`);
    texts[0] = 'Il a manger';
    withBlocks(editor, [texts]);
    const session = open(EMAIL);
    wait.mockImplementation(() => {
      session.stop();
      return new Promise(() => {});
    });
    api.generate
      .mockResolvedValueOnce(found(fix('text', 'a manger', 'a mangé')))
      .mockRejectedValueOnce(rateLimited(40))
      .mockResolvedValueOnce(found(fix('text', 'a manger', 'a mangé')))
      .mockResolvedValueOnce(NONE);
    await session.request();
    await session.resume();
    expect(api.generate).toHaveBeenCalledTimes(4);
    expect(session.state.corrections).toHaveLength(1);
    expect(session.state.progress).toEqual({ done: 1, total: 1 });
  });

  it('starts again from the start, forgetting what it found', async () => {
    withBlocks(editor, ['Il a manger', 'Texte']);
    api.generate
      .mockRejectedValueOnce({ response: { status: 502 } })
      .mockResolvedValueOnce(found(fix('text', 'a manger', 'a mangé')))
      .mockRejectedValueOnce({ response: { status: 502 } })
      .mockResolvedValue(NONE);
    const session = open(EMAIL);
    await session.request();
    expect(session.state.failedBlocks).toEqual(['ko_textBlock_2']);
    expect(session.state.corrections).toHaveLength(1);
    await session.restart();
    expect(api.generate.mock.calls.slice(3).map(blocksOf)).toEqual([
      ['ko_textBlock_1', 'ko_textBlock_2'],
    ]);
    expect(session.state).toEqual(
      expect.objectContaining({
        corrections: [],
        failedBlocks: [],
        dropped: 0,
        unchecked: 0,
        progress: { done: 2, total: 2 },
        nothingToCorrect: false,
        stopped: false,
        error: null,
      })
    );
  });

  it('asks nothing again when the panel comes back to a session that ran', async () => {
    api.generate.mockResolvedValue(
      found(fix('titleText', 'soldes commence', 'soldes commencent'))
    );
    const session = open(FIELD_TARGET);
    const first = session.request();
    expect(session.request()).toBe(first);
    await first;
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.corrections).toHaveLength(1);
  });

  it('starts a field again when asked to resume it', async () => {
    api.generate.mockResolvedValue(
      found(fix('titleText', 'soldes commence', 'soldes commencent'))
    );
    const session = open(FIELD_TARGET);
    await session.request();
    expect(session.state.canResume).toBe(false);
    session.ignore(session.state.corrections[0].id);
    await session.resume();
    expect(api.generate).toHaveBeenCalledTimes(2);
    expect(session.state.corrections.map((c) => c.status)).toEqual(['pending']);
  });
});
