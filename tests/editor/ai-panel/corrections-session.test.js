'use strict';

/**
 * Acceptance tests of the spelling correction (epic #1251, ADR 0005): the
 * steps of the « corrections » family, outside any component.
 *
 * Seam: a session per action, over a mocked API and a mocked editor. The
 * session sends the visible text of the fields, lists the corrections the
 * server could place, and writes one only when the user accepts it; the
 * editor's own undo takes it back (Ctrl+Z), « Tout accepter » as one step.
 */

const FIELD_TARGET = {
  kind: 'blockField',
  blockId: 'ko_textBlock_3',
  blockType: 'textBlock',
  field: 'titleText',
};
const BLOCK_TARGET = {
  kind: 'block',
  blockId: 'ko_textBlock_3',
  blockType: 'textBlock',
};
const EMAIL = { kind: 'email' };

// The text fields of the email, as the listing of a block's text fields
// (#1253) gives them.
const FIELDS = {
  ko_textBlock_3: [
    {
      path: 'titleText',
      role: 'title',
      html: '<p>Les soldes commence demain</p>',
      hidden: false,
      sample: false,
    },
    {
      path: 'longText',
      role: 'text',
      html: '<p>Profitez de <strong>-30 %</strong> sur la colection</p>',
      hidden: false,
      sample: false,
    },
    {
      path: 'image.alt',
      role: 'alt',
      html: 'Une robe en lin bleu',
      hidden: false,
      sample: false,
    },
    {
      path: 'subtitleText',
      role: 'title',
      html: 'Sous-titre caché',
      hidden: true,
      sample: false,
    },
    {
      path: 'buttonText',
      role: 'button',
      html: 'Bouton',
      hidden: false,
      sample: true,
    },
  ],
  ko_footerBlock_9: [
    {
      path: 'legalText',
      role: 'text',
      html: 'Vous recevez cet email car vous etes inscrit.',
      hidden: false,
      sample: false,
    },
  ],
};

function fakeEditor() {
  const html = {};
  Object.entries(FIELDS).forEach(([blockId, fields]) => {
    fields.forEach((f) => {
      html[`${blockId}:${f.path}`] = f.html;
    });
  });
  const calls = [];
  return {
    html,
    calls,
    mailingId: 'm1',
    blocks: () => [
      { blockId: 'ko_textBlock_3', blockType: 'textBlock' },
      { blockId: 'ko_footerBlock_9', blockType: 'footerBlock' },
    ],
    textFieldsOf: (blockId) =>
      FIELDS[blockId].map((f) => ({
        ...f,
        html: html[`${blockId}:${f.path}`],
      })),
    readField: (blockId, path) => html[`${blockId}:${path}`],
    writeField: (blockId, path, value) => {
      calls.push(['writeField', blockId, path, value]);
      html[`${blockId}:${path}`] = value;
    },
    startMultiple: () => calls.push(['startMultiple']),
    stopMultiple: () => calls.push(['stopMultiple']),
  };
}

const fix = (field, before, after, reason = 'Orthographe') => ({
  field,
  before,
  after,
  reason,
});

describe('spelling correction: the steps of a correction', () => {
  let createActionSession;
  let api;
  let editor;
  let wait;

  beforeAll(() => {
    ({
      createActionSession,
    } = require('../../../packages/editor/src/js/ext/ai-panel/action-session'));
  });

  beforeEach(() => {
    api = { generate: jest.fn() };
    editor = fakeEditor();
    wait = jest.fn().mockResolvedValue();
  });

  const open = (target) =>
    createActionSession({
      action: 'correct-text',
      target,
      api,
      editor,
      wait,
    });

  describe('a field', () => {
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
      expect(session.state.corrections.map((c) => c.before)).toEqual([
        'demain',
      ]);
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

    it('reports an error the user can act on, by status', async () => {
      api.generate.mockRejectedValue({ response: { status: 403 } });
      const session = open(FIELD_TARGET);
      await session.request();
      expect(session.state.error).toBe('text-generation-error-disabled');
    });
  });

  // Turned on by #1255 (correct a block)
  describe.skip('a block', () => {
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
      expect(session.state.leftOut).toEqual({ hidden: 1, sample: 1 });
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
      expect(
        editor.calls.filter(([name]) => name === 'writeField')
      ).toHaveLength(2);
      expect(editor.html['ko_textBlock_3:longText']).toBe(
        '<p>Profitez de <strong>-30 %</strong> sur la collection</p>'
      );
      expect(session.state.corrections.map((c) => c.status)).toEqual([
        'accepted',
        'accepted',
      ]);
    });
  });

  // Turned on by #1256 (correct the whole email)
  describe.skip('the whole email', () => {
    it('corrects one block after the other, with the progress, the corrections grouped by block', async () => {
      api.generate
        .mockResolvedValueOnce({
          corrections: [
            fix('titleText', 'soldes commence', 'soldes commencent'),
          ],
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
});
