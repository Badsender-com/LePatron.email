'use strict';

/**
 * Acceptance tests of the spelling correction of one field (epic #1251, ADR
 * 0011): the steps of the « corrections » family, outside any component.
 *
 * Seam: a session per action, over a mocked API and a mocked editor. The
 * session sends the visible text of the field, lists the corrections the
 * server could place, and writes one only when the user accepts it; the
 * editor's own undo takes it back (Ctrl+Z).
 */

const {
  FIELD_TARGET,
  fix,
  correctionsSetup,
} = require('../helpers/corrections-session');

let api;
let editor;
let open;

beforeEach(() => {
  ({ api, editor, open } = correctionsSetup());
});

describe('spelling correction: a field', () => {
  it('sends the visible text of the targeted field only', async () => {
    api.generate.mockResolvedValue({ corrections: [], dropped: 0 });
    await open(FIELD_TARGET).request();
    expect(api.generate).toHaveBeenCalledWith('corrections', {
      mailingId: 'm1',
      target: FIELD_TARGET,
      fields: [
        {
          path: 'titleText',
          role: 'title',
          text: 'Les soldes commence demain',
        },
      ],
    });
  });

  it('lists the corrections to accept, and writes nothing yet', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    expect(session.state.corrections).toEqual([
      expect.objectContaining({
        blockId: 'ko_textBlock_3',
        field: 'titleText',
        before: 'soldes commence',
        after: 'soldes commencent',
        reason: 'Orthographe',
        status: 'pending',
      }),
    ]);
    expect(editor.calls).toEqual([]);
  });

  it('writes an accepted correction into the field, as one step of the editor undo', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    session.accept(session.state.corrections[0].id);
    expect(editor.calls).toEqual([
      ['startMultiple'],
      [
        'writeField',
        'ko_textBlock_3',
        'titleText',
        '<p>Les soldes commencent demain</p>',
      ],
      ['stopMultiple'],
    ]);
    expect(session.state.corrections[0].status).toBe('accepted');
  });

  it('ignores a correction without writing it', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    session.ignore(session.state.corrections[0].id);
    expect(session.state.corrections[0].status).toBe('ignored');
    expect(editor.calls).toEqual([]);
  });

  it('does not apply a correction whose text changed since', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    editor.html['ko_textBlock_3:titleText'] = '<p>Nos soldes démarrent</p>';
    session.accept(session.state.corrections[0].id);
    expect(session.state.corrections[0].status).toBe('stale');
    expect(editor.html['ko_textBlock_3:titleText']).toBe(
      '<p>Nos soldes démarrent</p>'
    );
  });

  it('leaves out a correction that crosses the formatting, and counts it', async () => {
    editor.html['ko_textBlock_3:titleText'] =
      '<p>Les <strong>soldes</strong> commence demain</p>';
    api.generate.mockResolvedValue({
      corrections: [
        fix('titleText', 'soldes commence', 'soldes commencent'),
        fix('titleText', 'demain', 'demain matin'),
      ],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    expect(session.state.corrections.map((c) => c.before)).toEqual(['demain']);
    expect(session.state.dropped).toBe(1);
  });

  it('corrects a field the user targets even when it holds sample text', async () => {
    api.generate.mockResolvedValue({ corrections: [], dropped: 0 });
    await open({ ...FIELD_TARGET, field: 'buttonText' }).request();
    expect(api.generate.mock.calls[0][1].fields).toEqual([
      { path: 'buttonText', role: 'button', text: 'Bouton' },
    ]);
  });

  it('says when there is nothing to correct', async () => {
    api.generate.mockResolvedValue({ corrections: [], dropped: 0 });
    const session = open(FIELD_TARGET);
    await session.request();
    expect(session.state.corrections).toEqual([]);
    expect(session.state.done).toBe(true);
  });

  it('writes an alternative text as plain text, never as HTML', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('image.alt', 'lin bleu', 'lin "bleu" & blanc')],
      dropped: 0,
    });
    const session = open({ ...FIELD_TARGET, field: 'image.alt' });
    await session.request();
    session.accept(session.state.corrections[0].id);
    expect(editor.html['ko_textBlock_3:image.alt']).toBe(
      'Une robe en lin "bleu" & blanc'
    );
  });

  it('keeps its own id and block whatever the server answers', async () => {
    api.generate.mockResolvedValue({
      corrections: [
        {
          ...fix('titleText', 'soldes commence', 'soldes commencent'),
          id: 'x',
          blockId: 'ko_other_1',
          status: 'accepted',
        },
      ],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    expect(session.state.corrections[0]).toEqual(
      expect.objectContaining({
        id: 1,
        blockId: 'ko_textBlock_3',
        status: 'pending',
      })
    );
  });

  it('marks a correction of a deleted block as not applied, without failing', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    delete editor.html['ko_textBlock_3:titleText'];
    session.accept(session.state.corrections[0].id);
    expect(session.state.corrections[0].status).toBe('stale');
  });

  it('marks a correction not applied when the editor leaves the field as it was', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    // As the editor does for a block gone: nothing written, nothing thrown.
    editor.writeField = () => {};
    const session = open(FIELD_TARGET);
    await session.request();
    expect(session.accept(session.state.corrections[0].id)).toEqual({
      accepted: 0,
      stale: 1,
    });
    expect(session.state.corrections[0].status).toBe('stale');
    expect(editor.calls).toContainEqual(['stopMultiple']);
  });

  it('counts as accepted a correction the text already holds', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    editor.html['ko_textBlock_3:titleText'] =
      '<p>Les soldes commencent demain</p>';
    session.accept(session.state.corrections[0].id);
    expect(session.state.corrections[0].status).toBe('accepted');
    expect(editor.calls.filter(([name]) => name === 'writeField')).toEqual([]);
  });

  it('shows an accepted correction the undo took back as undone, to accept again', async () => {
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'soldes commence', 'soldes commencent')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    const [correction] = session.state.corrections;
    session.accept(correction.id);
    // The editor's undo puts the text back.
    editor.html['ko_textBlock_3:titleText'] =
      '<p>Les soldes commence demain</p>';
    session.refresh();
    expect(correction.status).toBe('undone');
    // Redone: accepted again.
    editor.html['ko_textBlock_3:titleText'] =
      '<p>Les soldes commencent demain</p>';
    session.refresh();
    expect(correction.status).toBe('accepted');
    editor.html['ko_textBlock_3:titleText'] =
      '<p>Les soldes commence demain</p>';
    session.refresh();
    session.accept(correction.id);
    expect(correction.status).toBe('accepted');
    expect(editor.html['ko_textBlock_3:titleText']).toBe(
      '<p>Les soldes commencent demain</p>'
    );
  });

  it('knows an accepted correction after an undo and a redo, its new text elsewhere in the field too', async () => {
    editor.html['ko_textBlock_3:titleText'] = '<p>ça marche. Et sa ?</p>';
    api.generate.mockResolvedValue({
      corrections: [fix('titleText', 'sa', 'ça')],
      dropped: 0,
    });
    const session = open(FIELD_TARGET);
    await session.request();
    const [correction] = session.state.corrections;
    session.accept(correction.id);
    expect(editor.html['ko_textBlock_3:titleText']).toBe(
      '<p>ça marche. Et ça ?</p>'
    );
    editor.html['ko_textBlock_3:titleText'] = '<p>ça marche. Et sa ?</p>';
    session.refresh();
    expect(correction.status).toBe('undone');
    editor.html['ko_textBlock_3:titleText'] = '<p>ça marche. Et ça ?</p>';
    session.refresh();
    expect(correction.status).toBe('accepted');
  });

  it('undoes and redoes with the editor', () => {
    editor.undo = jest.fn();
    editor.redo = jest.fn();
    const session = open(FIELD_TARGET);
    session.undo();
    session.redo();
    expect(editor.undo).toHaveBeenCalled();
    expect(editor.redo).toHaveBeenCalled();
  });

  it('reports an error the user can act on, by the code the server sends', async () => {
    api.generate.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'TEXT_GENERATION_DISABLED' },
      },
    });
    const session = open(FIELD_TARGET);
    await session.request();
    expect(session.state.error).toBe('text-generation-error-disabled');
  });
});
