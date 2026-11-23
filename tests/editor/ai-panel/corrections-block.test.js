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
        sample: false,
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
        sample: false,
      }));
    api.generate.mockResolvedValue({ corrections: [], dropped: 0 });
    await open(BLOCK_TARGET).request();
    expect(
      api.generate.mock.calls.map(([, body]) => body.fields.length)
    ).toEqual([40, 5]);
  });

  it('says there is nothing to correct when every field is hidden or left at its sample, without a request', async () => {
    editor.textFieldsOf = () => [
      {
        path: 'buttonText',
        role: 'button',
        html: 'Bouton',
        hidden: false,
        sample: true,
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
