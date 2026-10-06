'use strict';

/**
 * Acceptance tests of the AI panel (epic #1177): the steps of an AI action,
 * outside any component, so that the panel only renders them.
 *
 * Seam: a session per action, over a mocked API and a mocked editor. Nothing is
 * written into the email before `apply`; `undo` takes back in one step what
 * `apply` wrote (ADR 0003, ADR 0004).
 */

const COPY = [{ role: 'title', text: 'Les soldes commencent' }];

function fakeEditor(overrides = {}) {
  const state = { subject: 'Ancien objet', preheader: 'Ancien préheader' };
  const calls = [];
  return {
    state,
    calls,
    mailingId: 'm1',
    emailCopy: () => COPY,
    canApplySubject: true,
    canApplyPreheader: true,
    getSubject: () => state.subject,
    setSubject: (value) => {
      calls.push(['setSubject', value]);
      state.subject = value;
    },
    getPreheader: () => state.preheader,
    setPreheader: (value) => {
      calls.push(['setPreheader', value]);
      state.preheader = value;
    },
    startMultiple: () => calls.push(['startMultiple']),
    stopMultiple: () => calls.push(['stopMultiple']),
    ...overrides,
  };
}

const answer = (...texts) => ({
  proposals: texts.map((text, index) => ({
    text,
    angle: `Angle ${index}`,
    facts: { length: text.length },
  })),
  dropped: 0,
});

describe('ai panel: the steps of an AI action', () => {
  let createActionSession;
  let api;
  let editor;

  beforeAll(() => {
    ({
      createActionSession,
    } = require('../../../packages/editor/src/js/ext/ai-panel/action-session'));
  });

  beforeEach(() => {
    api = { generate: jest.fn() };
    editor = fakeEditor();
  });

  describe('generate the subject', () => {
    let session;
    beforeEach(() => {
      session = createActionSession({
        action: 'generate-subject',
        api,
        editor,
      });
    });

    it('asks for proposals from the email copy, the current subject and the instruction', async () => {
      api.generate.mockResolvedValue(answer('A', 'B', 'C'));
      await session.request({ brief: 'Insister sur la livraison' });
      expect(api.generate).toHaveBeenCalledWith('subject', {
        mailingId: 'm1',
        content: COPY,
        currentSubject: 'Ancien objet',
        brief: 'Insister sur la livraison',
      });
      expect(session.state.proposals.map((p) => p.text)).toEqual([
        'A',
        'B',
        'C',
      ]);
    });

    it('sends the proposals already seen when asked for others', async () => {
      api.generate
        .mockResolvedValueOnce(answer('A', 'B', 'C'))
        .mockResolvedValueOnce(answer('D', 'E', 'F'));
      await session.request({});
      await session.requestMore();
      expect(api.generate.mock.calls[1][1].avoid).toEqual(['A', 'B', 'C']);
      expect(session.state.proposals.map((p) => p.text)).toEqual([
        'D',
        'E',
        'F',
      ]);
    });

    it('writes nothing before apply', async () => {
      api.generate.mockResolvedValue(answer('A', 'B', 'C'));
      await session.request({});
      session.select(1);
      expect(editor.calls).toEqual([]);
      expect(editor.state.subject).toBe('Ancien objet');
    });

    it('applies the picked subject, then undoes it in one step', async () => {
      api.generate.mockResolvedValue(answer('A', 'B', 'C'));
      await session.request({});
      session.select(1);
      session.apply();
      expect(editor.state.subject).toBe('B');
      expect(session.state.applied).toEqual({ subject: 'B' });
      session.undo();
      expect(editor.state.subject).toBe('Ancien objet');
    });

    it('offers to copy instead when the email has no subject field', async () => {
      editor = fakeEditor({ canApplySubject: false });
      session = createActionSession({
        action: 'generate-subject',
        api,
        editor,
      });
      api.generate.mockResolvedValue(answer('A', 'B', 'C'));
      await session.request({});
      session.select(0);
      expect(session.canApply()).toBe(false);
      expect(() => session.apply()).toThrow();
      expect(session.textToCopy()).toBe('A');
    });

    it('reports an error the user can act on, by status', async () => {
      api.generate.mockRejectedValue({ response: { status: 403 } });
      await session.request({});
      expect(session.state.error).toBe('text-generation-error-disabled');
    });
  });

  describe('generate the preheader', () => {
    it('builds on the current subject', async () => {
      const session = createActionSession({
        action: 'generate-preheader',
        api,
        editor,
      });
      api.generate.mockResolvedValue(answer('P1', 'P2', 'P3'));
      await session.request({});
      expect(api.generate).toHaveBeenCalledWith(
        'preheader',
        expect.objectContaining({
          subject: 'Ancien objet',
          currentPreheader: 'Ancien préheader',
        })
      );
    });

    it('can go on without a subject, and then sends none', async () => {
      editor.state.subject = '';
      const session = createActionSession({
        action: 'generate-preheader',
        api,
        editor,
      });
      api.generate.mockResolvedValue(answer('P1', 'P2', 'P3'));
      await session.request({});
      expect(api.generate.mock.calls[0][1]).not.toHaveProperty('subject');
    });

    it('writes the preheader as one step of the editor undo, and undoes it', async () => {
      const session = createActionSession({
        action: 'generate-preheader',
        api,
        editor,
      });
      api.generate.mockResolvedValue(answer('P1', 'P2', 'P3'));
      await session.request({});
      session.select(2);
      session.apply();
      expect(editor.calls).toEqual([
        ['startMultiple'],
        ['setPreheader', 'P3'],
        ['stopMultiple'],
      ]);
      session.undo();
      expect(editor.state.preheader).toBe('Ancien préheader');
    });
  });

  describe('the next step', () => {
    it('offers the preheader once a subject is applied', async () => {
      const session = createActionSession({
        action: 'generate-subject',
        api,
        editor,
      });
      api.generate.mockResolvedValue(answer('A', 'B', 'C'));
      await session.request({});
      session.select(0);
      session.apply();
      expect(session.nextAction()).toBe('generate-preheader');
    });
  });
});
