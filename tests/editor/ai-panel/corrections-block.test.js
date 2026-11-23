'use strict';

/**
 * Acceptance tests of the spelling correction of one block (epic #1251, ADR
 * 0011): which fields it sends, in how many requests, and « Tout accepter »
 * as one step of the editor's undo.
 */

const {
  BLOCK_TARGET,
  FIELDS,
  fix,
  correctionsSetup,
} = require('../helpers/corrections-session');

let api;
let editor;
let open;

beforeEach(() => {
  ({ api, editor, open } = correctionsSetup());
});

describe('spelling correction: a block', () => {
  it('sends every visible text field, alternative texts included, and leaves hidden and sample fields out', async () => {
    api.generate.mockResolvedValue({ corrections: [], dropped: 0 });
    const session = open(BLOCK_TARGET);
    await session.request();
    expect(api.generate.mock.calls[0][1].fields).toEqual([
      {
        path: 'titleText',
        role: 'title',
        text: 'Les soldes commence demain',
      },
      {
        path: 'longText',
        role: 'text',
        text: 'Profitez de -30 % sur la colection',
      },
      { path: 'image.alt', role: 'alt', text: 'Une robe en lin bleu' },
    ]);
    // A hidden field is left out quietly; one at its sample text is counted.
    expect(session.state.leftOut).toEqual({ sample: 1 });
  });

  it('leaves out, and counts, a field too long to be checked', async () => {
    editor.textFieldsOf = () => [
      { ...FIELDS.ko_textBlock_3[0] },
      {
        path: 'longText',
        role: 'text',
        html: `<p>${'a'.repeat(5001)}</p>`,
        hidden: false,
        atDefault: false,
      },
    ];
    api.generate.mockResolvedValue({ corrections: [], dropped: 0 });
    const session = open(BLOCK_TARGET);
    await session.request();
    expect(api.generate.mock.calls[0][1].fields.map((f) => f.path)).toEqual([
      'titleText',
    ]);
    expect(session.state.tooLong).toBe(1);
  });

  it('sends a block of many fields in several requests', async () => {
    editor.textFieldsOf = () =>
      Array.from({ length: 45 }, (_, i) => ({
        path: `text${i}`,
        role: 'text',
        html: `Texte ${i}`,
        hidden: false,
        atDefault: false,
      }));
    api.generate.mockResolvedValue({ corrections: [], dropped: 0 });
    await open(BLOCK_TARGET).request();
    expect(
      api.generate.mock.calls.map(([, body]) => body.fields.length)
    ).toEqual([40, 5]);
  });

  describe('in several requests', () => {
    const manyFields = () =>
      Array.from({ length: 45 }, (_, i) => ({
        path: `text${i}`,
        role: 'text',
        html: i ? `Texte ${i}` : 'Il a manger',
        hidden: false,
        atDefault: false,
      }));

    beforeEach(() => {
      editor.textFieldsOf = manyFields;
      editor.html['ko_textBlock_3:text0'] = 'Il a manger';
    });

    it('counts the fields left unchecked when one request fails, keeping the others', async () => {
      api.generate
        .mockResolvedValueOnce({
          corrections: [fix('text0', 'a manger', 'a mangé')],
          dropped: 0,
        })
        .mockRejectedValueOnce({ response: { status: 502 } });
      const session = open(BLOCK_TARGET);
      await session.request();
      expect(session.state.unchecked).toBe(5);
      expect(session.state.corrections).toHaveLength(1);
      expect(session.state.error).toBeNull();
    });

    it('reports the failure when every request fails', async () => {
      api.generate.mockRejectedValue({ response: { status: 502 } });
      const session = open(BLOCK_TARGET);
      await session.request();
      expect(session.state.error).toBe('text-generation-error-failed');
    });

    it('says it was interrupted when stopped before its last request, and starts again on resume', async () => {
      const session = open(BLOCK_TARGET);
      api.generate
        .mockImplementationOnce(async () => {
          session.stop();
          return { corrections: [], dropped: 0 };
        })
        .mockResolvedValue({ corrections: [], dropped: 0 });
      await session.request();
      expect(api.generate).toHaveBeenCalledTimes(1);
      expect(session.state.stopped).toBe(true);
      expect(session.state.canResume).toBe(true);
      await session.resume();
      expect(api.generate).toHaveBeenCalledTimes(3);
      expect(session.state.canResume).toBe(false);
      expect(session.state.stopped).toBe(false);
    });
  });

  it('is not interrupted when stopped during its only request', async () => {
    const session = open(BLOCK_TARGET);
    api.generate.mockImplementationOnce(async () => {
      session.stop();
      return { corrections: [], dropped: 0 };
    });
    await session.request();
    expect(session.state.canResume).toBe(false);
    expect(session.state.stopped).toBe(false);
  });

  it('says there is nothing to correct when every field is hidden or left at its sample, without a request', async () => {
    editor.textFieldsOf = () => [
      {
        path: 'buttonText',
        role: 'button',
        html: 'Bouton',
        hidden: false,
        atDefault: true,
      },
    ];
    const session = open(BLOCK_TARGET);
    await session.request();
    expect(api.generate).not.toHaveBeenCalled();
    expect(session.state.nothingToCorrect).toBe(true);
    expect(session.state.done).toBe(true);
  });

  it('tells each correction’s field by its role', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('image.alt', 'robe en lin bleu', 'robe en lin bleue')],
      dropped: 0,
    });
    const session = open(BLOCK_TARGET);
    await session.request();
    expect(session.state.corrections[0].role).toBe('alt');
  });

  it('keeps what the server says of a correction that rewrites', async () => {
    api.generate.mockResolvedValue({
      corrections: [
        {
          ...fix('titleText', 'soldes commence', 'soldes débutent'),
          rewrite: true,
        },
        fix('titleText', 'demain', 'dès demain'),
      ],
      dropped: 0,
    });
    const session = open(BLOCK_TARGET);
    await session.request();
    expect(session.state.corrections.map((c) => c.rewrite)).toEqual([
      true,
      undefined,
    ]);
  });

  it('leaves a correction that rewrites out of « Tout accepter »: it is accepted on its own', async () => {
    api.generate.mockResolvedValue({
      corrections: [
        {
          ...fix('titleText', 'soldes commence', 'soldes débutent'),
          rewrite: true,
        },
        fix('longText', 'la colection', 'la collection'),
      ],
      dropped: 0,
    });
    const session = open(BLOCK_TARGET);
    await session.request();
    expect(session.acceptAll()).toEqual({ accepted: 1, stale: 0 });
    expect(session.acceptBlock('ko_textBlock_3')).toEqual({
      accepted: 0,
      stale: 0,
    });
    expect(session.state.corrections.map((c) => c.status)).toEqual([
      'pending',
      'accepted',
    ]);
    expect(
      editor.calls.filter(([name]) => name === 'startMultiple')
    ).toHaveLength(1);
    const [rewrite] = session.state.corrections;
    expect(session.accept(rewrite.id)).toEqual({ accepted: 1, stale: 0 });
  });

  it('accepts all the corrections of the block as one step of the editor undo', async () => {
    api.generate.mockResolvedValue({
      corrections: [
        fix('titleText', 'soldes commence', 'soldes commencent'),
        fix('longText', 'la colection', 'la collection'),
      ],
      dropped: 0,
    });
    const session = open(BLOCK_TARGET);
    await session.request();
    session.acceptAll();
    expect(
      editor.calls.filter(([name]) => name === 'startMultiple')
    ).toHaveLength(1);
    expect(editor.calls.filter(([name]) => name === 'writeField')).toHaveLength(
      2
    );
    expect(editor.html['ko_textBlock_3:longText']).toBe(
      '<p>Profitez de <strong>-30 %</strong> sur la collection</p>'
    );
    expect(session.state.corrections.map((c) => c.status)).toEqual([
      'accepted',
      'accepted',
    ]);
  });
});
