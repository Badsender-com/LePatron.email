'use strict';

/**
 * Acceptance tests of the AI panel (epic #1177): which AI actions a target
 * offers, and whether its AI icon opens the action itself or the list.
 *
 * Seam: one pure function, so that the « Outils IA » panel, the icons and the
 * actions to come cannot disagree (ADR 0010).
 */

const SUBJECT_SKILL = 'redaction.objet';
const PREHEADER_SKILL = 'redaction.pre-header';
const CORRECTION_SKILL = 'redaction.correction';

const ON = {
  textGeneration: true,
  // The skills that run for the email's company (editor metadata).
  skills: [SUBJECT_SKILL, PREHEADER_SKILL, CORRECTION_SKILL],
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
    it('offers its actions as a list', () => {
      const result = availableActions({ kind: 'email' }, ON);
      expect(ids(result)).toEqual([
        'generate-subject',
        'generate-preheader',
        'correct-text',
      ]);
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

  // The context says what the user may do on this email
  // (ext/ai-panel/text-generation-access.js): without the right to edit the
  // content, text generation is off, as when the group has it off.
  describe('a user who may not run the actions', () => {
    const DENIED = { ...ON, textGeneration: false };

    it.each([
      [{ kind: 'email' }],
      [{ kind: 'subject' }],
      [{ kind: 'preheader' }],
      [{ kind: 'block', blockId: 'ko_textBlock_3', blockType: 'textBlock' }],
      [
        {
          kind: 'blockField',
          blockId: 'ko_textBlock_3',
          blockType: 'textBlock',
          field: 'titleText',
        },
      ],
    ])('offers nothing on %o', (target) => {
      expect(availableActions(target, DENIED)).toEqual({
        actions: [],
        opens: 'none',
      });
    });

    it('opens nothing from a field icon, nor an action asked by its id', () => {
      const ko = require('knockout');
      const {
        createAiPanel,
      } = require('../../../packages/editor/src/js/ext/ai-panel/ai-panel-controller');
      const isOpen = ko.observable(false);
      const panel = createAiPanel({
        ko,
        editor: { context: () => DENIED },
        api: { generate: jest.fn() },
        isOpen,
        selection: ko.observable(null),
      });

      panel.openTarget({ kind: 'subject' });
      panel.openTarget({ kind: 'preheader' });
      expect(panel.openAction('generate-subject', { kind: 'email' })).toBe(
        false
      );
      expect(isOpen()).toBe(false);
      expect(panel.session()).toBeNull();
      expect(panel.offerNow()({ kind: 'subject' }).actions).toEqual([]);
      panel.dispose();
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

  // Adding an AI action means adding its definition (#1192): the registry, the
  // session and the icons derive from it.
  describe('an action added by its definition alone', () => {
    let ACTIONS;
    const rewrite = {
      id: 'rewrite-text',
      family: 'proposals',
      feature: 'textGeneration',
      skill: 'redaction.reecriture',
      targets: ['blockField'],
      describe: () => ({ canApply: true }),
    };
    const WITH_REWRITE = { ...ON, skills: [...ON.skills, rewrite.skill] };
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
      expect(availableActions(titleOfCover, WITH_REWRITE, [rewrite])).toEqual({
        actions: [{ id: 'rewrite-text', canApply: true }],
        opens: 'action',
      });
    });

    it('is offered nowhere else', () => {
      expect(
        ids(
          availableActions({ kind: 'email' }, WITH_REWRITE, [
            ...ACTIONS,
            rewrite,
          ])
        )
      ).not.toContain('rewrite-text');
    });

    it('is not offered when its AI feature is off', () => {
      expect(
        availableActions(
          titleOfCover,
          { ...WITH_REWRITE, textGeneration: false },
          [...ACTIONS, rewrite]
        ).actions
      ).toEqual([]);
    });

    it('is not offered while its skill does not run for the company', () => {
      expect(availableActions(titleOfCover, ON, [rewrite]).actions).toEqual([]);
    });

    it('is offered nowhere when it names no skill', () => {
      const { skill: _skill, ...unnamed } = rewrite;
      expect(
        availableActions(titleOfCover, WITH_REWRITE, [unnamed]).actions
      ).toEqual([]);
    });
  });

  // The spelling correction (epic #1251, ADR 0011): « Corriger » on a block
  // field, a block and the whole email, with text generation.
  describe('« Corriger »', () => {
    const FIELD = {
      kind: 'blockField',
      blockId: 'ko_textBlock_3',
      blockType: 'textBlock',
      field: 'titleText',
    };
    const BLOCK = {
      kind: 'block',
      blockId: 'ko_textBlock_3',
      blockType: 'textBlock',
    };

    describe('on a block field', () => {
      it('is the field’s single action, opened directly', () => {
        expect(availableActions(FIELD, ON)).toEqual({
          actions: [{ id: 'correct-text', canApply: true }],
          opens: 'action',
        });
      });

      it('is not offered without text generation', () => {
        expect(
          availableActions(FIELD, { ...ON, textGeneration: false })
        ).toEqual({ actions: [], opens: 'none' });
      });
    });

    describe('on a block', () => {
      it('is the block’s single action, opened directly', () => {
        expect(availableActions(BLOCK, ON)).toEqual({
          actions: [{ id: 'correct-text', canApply: true }],
          opens: 'action',
        });
      });
    });

    describe('on the whole email', () => {
      it('comes after generating the subject and the preheader', () => {
        expect(ids(availableActions({ kind: 'email' }, ON))).toEqual([
          'generate-subject',
          'generate-preheader',
          'correct-text',
        ]);
      });
    });
  });

  // Each action calls one skill, published, opened to the client companies
  // and taken back on its own (ADR 0013): a skill that does not run for the
  // company hides its action only. The correction may be published after the
  // subject and the preheader without taking them away.
  describe('each action follows the skill it calls', () => {
    const FIELD = {
      kind: 'blockField',
      blockId: 'ko_textBlock_3',
      blockType: 'textBlock',
      field: 'titleText',
    };
    const BLOCK = {
      kind: 'block',
      blockId: 'ko_textBlock_3',
      blockType: 'textBlock',
    };
    const running = (...skills) => ({ ...ON, skills });

    it('names a skill the server lists for text generation', () => {
      const {
        ACTIONS,
      } = require('../../../packages/editor/src/js/ext/ai-panel/actions');
      const manifest = require('../../../packages/server/text-generation/skill-manifest.js');
      const served = manifest.usedSkills.map((used) => used.skillId);
      ACTIONS.forEach((definition) => {
        expect(served).toContain(definition.skill);
      });
    });

    describe('without the correction’s skill', () => {
      const context = running(SUBJECT_SKILL, PREHEADER_SKILL);

      it('still offers the subject and the preheader on the whole email', () => {
        const result = availableActions({ kind: 'email' }, context);
        expect(ids(result)).toEqual(['generate-subject', 'generate-preheader']);
        expect(result.opens).toBe('list');
      });

      it('still opens the subject and the preheader from their fields', () => {
        expect(ids(availableActions({ kind: 'subject' }, context))).toEqual([
          'generate-subject',
        ]);
        expect(ids(availableActions({ kind: 'preheader' }, context))).toEqual([
          'generate-preheader',
        ]);
      });

      it.each([
        ['a block', BLOCK],
        ['a block field', FIELD],
      ])('offers nothing on %s', (_label, target) => {
        expect(availableActions(target, context)).toEqual({
          actions: [],
          opens: 'none',
        });
      });
    });

    describe('with the correction’s skill alone', () => {
      const context = running(CORRECTION_SKILL);

      it('offers « Corriger » alone on the whole email, opened directly', () => {
        expect(availableActions({ kind: 'email' }, context)).toEqual({
          actions: [{ id: 'correct-text', canApply: true }],
          opens: 'action',
        });
      });

      it.each([[{ kind: 'subject' }], [{ kind: 'preheader' }]])(
        'offers nothing on %o',
        (target) => {
          expect(availableActions(target, context).actions).toEqual([]);
        }
      );
    });

    it('offers nothing when no skill runs for the company', () => {
      [{ kind: 'email' }, { kind: 'subject' }, BLOCK, FIELD].forEach(
        (target) => {
          expect(availableActions(target, running())).toEqual({
            actions: [],
            opens: 'none',
          });
        }
      );
    });

    it('offers nothing to a user who may not run them, every skill running', () => {
      expect(
        availableActions({ kind: 'email' }, { ...ON, textGeneration: false })
      ).toEqual({ actions: [], opens: 'none' });
    });

    it('urges no subject first when the subject’s skill does not run', () => {
      const [action] = availableActions(
        { kind: 'preheader' },
        { ...running(PREHEADER_SKILL), hasSubject: false }
      ).actions;
      expect(action.id).toBe('generate-preheader');
      expect(action.suggestFirst).toBeUndefined();
    });

    it('offers the preheader after the subject only while its skill runs', () => {
      const subjectWith = (context) =>
        availableActions({ kind: 'subject' }, context).actions[0];
      expect(subjectWith(ON).next).toBe('generate-preheader');
      expect(subjectWith(running(SUBJECT_SKILL)).next).toBeUndefined();
    });

    it('opens no action whose skill does not run, asked by its id', () => {
      const ko = require('knockout');
      const {
        createAiPanel,
      } = require('../../../packages/editor/src/js/ext/ai-panel/ai-panel-controller');
      const isOpen = ko.observable(false);
      const panel = createAiPanel({
        ko,
        editor: { context: () => running(SUBJECT_SKILL, PREHEADER_SKILL) },
        api: { generate: jest.fn() },
        isOpen,
        selection: ko.observable(null),
      });

      expect(panel.openAction('correct-text', { kind: 'email' })).toBe(false);
      panel.openTarget(FIELD);
      expect(isOpen()).toBe(false);
      expect(panel.session()).toBeNull();
      panel.dispose();
    });
  });

  // The text editor's toolbar is built once, before the current user is
  // known: it asks the registry with the company's data alone.
  describe('what the company offers, before the user is known', () => {
    let companyOffersOn;
    const metadata = (skills, feature = true) => ({
      hasTextGenerationFeature: feature,
      textGenerationSkills: skills,
    });

    beforeAll(() => {
      ({
        companyOffersOn,
      } = require('../../../packages/editor/src/js/ext/ai-panel/text-generation-access'));
    });

    it('offers an action on a block field while the correction’s skill runs', () => {
      expect(companyOffersOn(metadata(ON.skills), 'blockField')).toBe(true);
    });

    it('offers none on a block field without it', () => {
      expect(
        companyOffersOn(
          metadata([SUBJECT_SKILL, PREHEADER_SKILL]),
          'blockField'
        )
      ).toBe(false);
    });

    it('offers none without the feature, nor without metadata', () => {
      expect(companyOffersOn(metadata(ON.skills, false), 'blockField')).toBe(
        false
      );
      expect(companyOffersOn(undefined, 'blockField')).toBe(false);
    });
  });
});
