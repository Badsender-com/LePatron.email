'use strict';

/**
 * Acceptance tests of the AI panel (epic #1177): which AI actions a target
 * offers, and whether its AI icon opens the action itself or the list.
 *
 * Seam: one pure function, so that the « Outils IA » panel, the icons and the
 * actions to come cannot disagree (ADR 0004).
 */

const ON = {
  textGeneration: true,
  hasSubject: true,
  hasSubjectField: true,
  hasPreheaderField: true,
};

describe('ai panel: the action registry', () => {
  let availableActions;

  beforeAll(() => {
    ({
      availableActions,
    } = require('../../../packages/editor/src/js/ext/ai-panel/action-registry'));
  });

  const ids = (result) => result.actions.map((action) => action.id);

  describe('the whole email (« Outils IA » with nothing selected)', () => {
    it('offers both actions as a list', () => {
      const result = availableActions({ kind: 'email' }, ON);
      expect(ids(result)).toEqual(['generate-subject', 'generate-preheader']);
      expect(result.opens).toBe('list');
    });

    it('offers nothing when the group has no AI action enabled', () => {
      const result = availableActions(
        { kind: 'email' },
        { ...ON, textGeneration: false }
      );
      expect(result).toEqual({ actions: [], opens: 'none' });
    });
  });

  describe('the subject field', () => {
    it('opens its single action directly', () => {
      const result = availableActions({ kind: 'subject' }, ON);
      expect(ids(result)).toEqual(['generate-subject']);
      expect(result.opens).toBe('action');
    });
  });

  describe('the preheader field', () => {
    it('opens its single action directly', () => {
      const result = availableActions({ kind: 'preheader' }, ON);
      expect(ids(result)).toEqual(['generate-preheader']);
      expect(result.opens).toBe('action');
    });

    it('urges to generate the subject first when there is none, without forbidding it', () => {
      const [action] = availableActions(
        { kind: 'preheader' },
        { ...ON, hasSubject: false }
      ).actions;
      expect(action.id).toBe('generate-preheader');
      expect(action.suggestFirst).toBe('generate-subject');
    });

    it('suggests nothing first when the subject is there', () => {
      const [action] = availableActions({ kind: 'preheader' }, ON).actions;
      expect(action.suggestFirst).toBeUndefined();
    });
  });

  describe('a field the email does not have', () => {
    it('still offers the subject, to copy, when the email metadata are off', () => {
      const result = availableActions(
        { kind: 'email' },
        { ...ON, hasSubjectField: false }
      );
      const subject = result.actions.find((a) => a.id === 'generate-subject');
      expect(subject.canApply).toBe(false);
    });

    it('still offers the preheader, to copy, when the template declares none', () => {
      const result = availableActions(
        { kind: 'email' },
        { ...ON, hasPreheaderField: false }
      );
      const preheader = result.actions.find(
        (a) => a.id === 'generate-preheader'
      );
      expect(preheader.canApply).toBe(false);
    });

    it('applies both when both fields exist', () => {
      const result = availableActions({ kind: 'email' }, ON);
      expect(result.actions.every((a) => a.canApply)).toBe(true);
    });
  });

  describe('blocks and block fields', () => {
    it.each([
      [{ kind: 'block', blockType: 'coverBlock' }],
      [{ kind: 'blockField', blockType: 'coverBlock', field: 'titleText' }],
    ])('offer no action yet for %o', (target) => {
      expect(availableActions(target, ON)).toEqual({
        actions: [],
        opens: 'none',
      });
    });
  });

  // Adding an AI action means adding its definition (#1192): the registry, the
  // session and the icons derive from it.
  describe('an action added by its definition alone', () => {
    let ACTIONS;
    const rewrite = {
      id: 'rewrite-text',
      family: 'proposals',
      feature: 'textGeneration',
      targets: ['blockField'],
      describe: () => ({ canApply: true }),
    };
    const titleOfCover = {
      kind: 'blockField',
      blockId: 'ko_coverBlock_1',
      blockType: 'coverBlock',
      field: 'titleText',
    };

    beforeAll(() => {
      ({
        ACTIONS,
      } = require('../../../packages/editor/src/js/ext/ai-panel/actions'));
    });

    it('is offered on its targets, and opens directly when it is the only one', () => {
      expect(availableActions(titleOfCover, ON, [...ACTIONS, rewrite])).toEqual(
        {
          actions: [{ id: 'rewrite-text', canApply: true }],
          opens: 'action',
        }
      );
    });

    it('is offered nowhere else', () => {
      expect(
        ids(availableActions({ kind: 'email' }, ON, [...ACTIONS, rewrite]))
      ).toEqual(['generate-subject', 'generate-preheader']);
    });

    it('is not offered when its AI feature is off', () => {
      expect(
        availableActions(titleOfCover, { ...ON, textGeneration: false }, [
          ...ACTIONS,
          rewrite,
        ]).actions
      ).toEqual([]);
    });
  });
});
