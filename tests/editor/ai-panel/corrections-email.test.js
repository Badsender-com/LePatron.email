'use strict';

/**
 * Acceptance tests of the spelling correction of the whole email (epic #1251,
 * ADR 0011): its blocks in lots of consecutive blocks, one request per lot, a
 * lot that fails taken again block by block, and what stops it.
 */

const {
  EMAIL,
  fix,
  withBlocks,
  NONE,
  blocksOf,
  correctionsSetup,
} = require('../helpers/corrections-session');

let api;
let editor;
let open;

beforeEach(() => {
  ({ api, editor, open } = correctionsSetup());
});

// A block's text long enough that two make more than one lot.
const LONG = 'Bonjour à tous. '.repeat(250);
const SERVER_ERROR = { response: { status: 502 } };

describe('spelling correction: the whole email', () => {
  it('sends consecutive blocks in one request, each field naming its block, and puts each correction back on its block', async () => {
    api.generate.mockResolvedValueOnce({
      corrections: [
        {
          ...fix('legalText', 'vous etes', 'vous êtes', 'Accent'),
          blockId: 'ko_footerBlock_9',
        },
        {
          ...fix('titleText', 'soldes commence', 'soldes commencent'),
          blockId: 'ko_textBlock_3',
        },
      ],
      dropped: 0,
    });
    const session = open(EMAIL);
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    const [, body] = api.generate.mock.calls[0];
    expect(body.target).toEqual({
      kind: 'blocks',
      blocks: [
        { blockId: 'ko_textBlock_3', blockType: 'textBlock' },
        { blockId: 'ko_footerBlock_9', blockType: 'footerBlock' },
      ],
    });
    expect(body.fields.map((f) => [f.blockId, f.path])).toEqual([
      ['ko_textBlock_3', 'titleText'],
      ['ko_textBlock_3', 'longText'],
      ['ko_textBlock_3', 'image.alt'],
      ['ko_footerBlock_9', 'legalText'],
    ]);
    expect(session.state.progress).toEqual({ done: 2, total: 2 });
    expect(
      session.state.corrections.map((c) => [c.blockId, c.field, c.role])
    ).toEqual([
      ['ko_footerBlock_9', 'legalText', 'text'],
      ['ko_textBlock_3', 'titleText', 'title'],
    ]);
  });

  it('corrects an email of 30 small blocks in a few requests, each block once and in order', async () => {
    const blocks = withBlocks(
      editor,
      Array.from({ length: 30 }, (_, i) => `Bloc ${i} : ${'texte '.repeat(50)}`)
    );
    api.generate.mockResolvedValue(NONE);
    const session = open(EMAIL);
    await session.request();
    expect(api.generate.mock.calls.length).toBeLessThanOrEqual(3);
    expect(api.generate.mock.calls.flatMap(blocksOf)).toEqual(
      blocks.map((block) => block.blockId)
    );
    expect(session.state.progress).toEqual({ done: 30, total: 30 });
  });

  it('sends a block too long for a lot alone, and one too big for a request in parts', async () => {
    withBlocks(editor, [
      'Court',
      [LONG, LONG],
      Array.from({ length: 45 }, (_, i) => `Texte ${i}`),
      'Court',
    ]);
    api.generate.mockResolvedValue(NONE);
    await open(EMAIL).request();
    expect(
      api.generate.mock.calls.map(([, body]) => [
        body.target.kind,
        blocksOf([null, body]).join(),
        body.fields.length,
      ])
    ).toEqual([
      ['block', 'ko_textBlock_1', 1],
      ['block', 'ko_textBlock_2', 2],
      ['block', 'ko_textBlock_3', 40],
      ['block', 'ko_textBlock_3', 5],
      ['block', 'ko_textBlock_4', 1],
    ]);
  });

  it('takes a lot that failed again block by block: only the faulty block fails', async () => {
    withBlocks(editor, ['Il a manger', 'Texte du bloc', 'Nous avont']);
    api.generate
      .mockRejectedValueOnce(SERVER_ERROR)
      .mockResolvedValueOnce({
        corrections: [fix('text', 'a manger', 'a mangé')],
        dropped: 0,
      })
      .mockRejectedValueOnce(SERVER_ERROR)
      .mockResolvedValueOnce({
        corrections: [fix('text', 'avont', 'avons')],
        dropped: 0,
      });
    const session = open(EMAIL);
    await session.request();
    expect(api.generate.mock.calls.map(blocksOf)).toEqual([
      ['ko_textBlock_1', 'ko_textBlock_2', 'ko_textBlock_3'],
      ['ko_textBlock_1'],
      ['ko_textBlock_2'],
      ['ko_textBlock_3'],
    ]);
    expect(session.state.failedBlocks).toEqual(['ko_textBlock_2']);
    expect(session.state.corrections.map((c) => c.blockId)).toEqual([
      'ko_textBlock_1',
      'ko_textBlock_3',
    ]);
    expect(session.state.progress).toEqual({ done: 3, total: 3 });
    expect(session.state.error).toBeNull();
  });

  it('takes a lot again block by block on an unexpected answer, rather than stopping', async () => {
    withBlocks(editor, ['Un', 'Deux']);
    api.generate.mockResolvedValueOnce({}).mockResolvedValue(NONE);
    const session = open(EMAIL);
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(3);
    expect(session.state.failedBlocks).toEqual([]);
    expect(session.state.error).toBeNull();
  });

  it('reports a block that cannot be read, and goes on with the others', async () => {
    withBlocks(editor, ['Un', 'Deux', 'Trois']);
    const read = editor.textFieldsOf;
    editor.textFieldsOf = (blockId) => {
      if (blockId === 'ko_textBlock_2') throw new TypeError('gone');
      return read(blockId);
    };
    api.generate.mockResolvedValue(NONE);
    const session = open(EMAIL);
    await session.request();
    expect(api.generate.mock.calls.flatMap(blocksOf)).toEqual([
      'ko_textBlock_1',
      'ko_textBlock_3',
    ]);
    expect(session.state.failedBlocks).toEqual(['ko_textBlock_2']);
    expect(session.state.progress).toEqual({ done: 3, total: 3 });
  });

  it('counts the fields left unchecked when one part of a block fails', async () => {
    withBlocks(editor, [Array.from({ length: 45 }, (_, i) => `Texte ${i}`)]);
    api.generate
      .mockResolvedValueOnce(NONE)
      .mockRejectedValueOnce(SERVER_ERROR);
    const session = open(EMAIL);
    await session.request();
    expect(session.state.unchecked).toBe(5);
    expect(session.state.failedBlocks).toEqual([]);
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

  it.each([
    ['the network is down', { isAxiosError: true, request: {} }],
    ['no answer came back', { request: {} }],
    ['the user is signed out', { response: { status: 401 } }],
  ])('stops when %s', async (_label, failure) => {
    api.generate.mockRejectedValue(failure);
    const session = open(EMAIL);
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.failedBlocks).toEqual([]);
    expect(session.state.error).not.toBeNull();
  });

  it('stops after the lot under way when the user asks, keeping what it found', async () => {
    withBlocks(editor, [`Il a manger. ${LONG}`, LONG]);
    const session = open(EMAIL);
    api.generate.mockImplementationOnce(async () => {
      session.stop();
      return { corrections: [fix('text', 'a manger', 'a mangé')], dropped: 0 };
    });
    await session.request();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(session.state.stopped).toBe(true);
    expect(session.state.canResume).toBe(true);
    expect(session.state.corrections).toHaveLength(1);
    expect(session.state.progress).toEqual({ done: 1, total: 2 });
    expect(session.state.nothingToCorrect).toBe(false);
  });

  it('is not stopped when the user asks during the last lot', async () => {
    const session = open(EMAIL);
    api.generate.mockImplementationOnce(async () => {
      session.stop();
      return NONE;
    });
    await session.request();
    expect(session.state.progress).toEqual({ done: 2, total: 2 });
    expect(session.state.stopped).toBe(false);
    expect(session.state.canResume).toBe(false);
  });

  it('asks nothing more once the panel lets go of it', async () => {
    withBlocks(editor, [LONG, LONG]);
    const session = open(EMAIL);
    api.generate.mockImplementationOnce(async () => {
      session.cancel();
      return NONE;
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
});
