'use strict';

/**
 * Acceptance tests of the spelling correction of the whole email (epic #1251,
 * ADR 0011): the loop over the blocks, its progress, its pauses on the AI
 * rate limit, and what stops it.
 */

const {
  EMAIL,
  fix,
  correctionsSetup,
} = require('../helpers/corrections-session');

let api;
let editor;
let wait;
let open;

beforeEach(() => {
  ({ api, editor, wait, open } = correctionsSetup());
});

describe('spelling correction: the whole email', () => {
  it('corrects one block after the other, with the progress, the corrections grouped by block', async () => {
    api.generate
      .mockResolvedValueOnce({
        corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
        dropped: 0,
      })
      .mockResolvedValueOnce({
        corrections: [fix('legalText', 'vous etes', 'vous êtes', 'Accent')],
        dropped: 0,
      });
    const session = open(EMAIL);
    await session.request();
    expect(
      api.generate.mock.calls.map(([, body]) => body.target.blockId)
    ).toEqual(['ko_textBlock_3', 'ko_footerBlock_9']);
    expect(session.state.progress).toEqual({ done: 2, total: 2 });
    expect(session.state.corrections.map((c) => c.blockId)).toEqual([
      'ko_textBlock_3',
      'ko_footerBlock_9',
    ]);
  });

  it('pauses on the AI rate limit for the delay the server gives, then goes on', async () => {
    api.generate
      .mockRejectedValueOnce({
        response: { status: 429, data: { retryAfterSeconds: 40 } },
      })
      .mockResolvedValue({ corrections: [], dropped: 0 });
    const session = open(EMAIL);
    await session.request();
    expect(wait).toHaveBeenCalledWith(40000);
    expect(api.generate).toHaveBeenCalledTimes(3);
    expect(session.state.progress).toEqual({ done: 2, total: 2 });
    expect(session.state.error).toBeNull();
  });

  it('stops on a failure of the feature itself, rather than failing every block', async () => {
    api.generate.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'TEXT_GENERATION_DISABLED' },
      },
    });
    const session = open(EMAIL);
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.error).toBe('text-generation-error-disabled');
    expect(session.state.failedBlocks).toEqual([]);
  });

  it('stops, rather than waiting, when the rate limit holds for long', async () => {
    api.generate.mockRejectedValue({
      response: { status: 429, data: { retryAfterSeconds: 3600 } },
    });
    const session = open(EMAIL);
    await session.request();
    expect(wait).not.toHaveBeenCalled();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.error).toBe('text-generation-error-rate-limited');
  });

  it.each([
    ['the network is down', {}],
    ['the user is signed out', { response: { status: 401 } }],
  ])('stops when %s', async (_label, failure) => {
    api.generate.mockRejectedValue(failure);
    const session = open(EMAIL);
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.failedBlocks).toEqual([]);
    expect(session.state.error).not.toBeNull();
  });

  it('stops after the block under way when the user asks, keeping what it found', async () => {
    const session = open(EMAIL);
    api.generate.mockImplementationOnce(async () => {
      session.stop();
      return {
        corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
        dropped: 0,
      };
    });
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.stopped).toBe(true);
    expect(session.state.corrections).toHaveLength(1);
    expect(session.state.progress).toEqual({ done: 1, total: 2 });
    expect(session.state.nothingToCorrect).toBe(false);
  });

  it('asks nothing more once the panel lets go of it', async () => {
    const session = open(EMAIL);
    api.generate.mockImplementationOnce(async () => {
      session.cancel();
      return { corrections: [], dropped: 0 };
    });
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
  });

  it('names a block and goes to it, through the editor', () => {
    editor.blockLabel = (id) => `Bloc ${id}`;
    editor.canGoToBlock = () => true;
    editor.goToBlock = jest.fn();
    const session = open(EMAIL);
    expect(session.blockLabel('ko_textBlock_3')).toBe('Bloc ko_textBlock_3');
    expect(session.canGoToBlock('ko_textBlock_3')).toBe(true);
    session.goToBlock('ko_textBlock_3');
    expect(editor.goToBlock).toHaveBeenCalledWith('ko_textBlock_3');
  });

  it('reports a block that failed and goes on with the others', async () => {
    api.generate
      .mockRejectedValueOnce({ response: { status: 502 } })
      .mockResolvedValueOnce({
        corrections: [fix('legalText', 'vous etes', 'vous êtes')],
        dropped: 0,
      });
    const session = open(EMAIL);
    await session.request();
    expect(session.state.failedBlocks).toEqual(['ko_textBlock_3']);
    expect(session.state.corrections.map((c) => c.blockId)).toEqual([
      'ko_footerBlock_9',
    ]);
  });
});
