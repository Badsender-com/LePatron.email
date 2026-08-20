'use strict';

const { Types } = require('mongoose');

// ── Mocks ───────────────────────────────────────────────────────────────────
jest.mock('../../../../packages/server/common/models.common', () => ({
  LePatronSkills: { findOne: jest.fn() },
  AISkillInvocations: { create: jest.fn() },
  AIFeatureConfigs: { findOne: jest.fn() },
  Integrations: { findById: jest.fn() },
  Groups: { findById: jest.fn() },
}));

const mockProvider = { chatComplete: jest.fn() };

jest.mock(
  '../../../../packages/server/integration-providers/provider-factory',
  () => ({
    createProvider: jest.fn(() => mockProvider),
  })
);

const {
  LePatronSkills,
  AISkillInvocations,
  AIFeatureConfigs,
  Integrations,
  Groups,
} = require('../../../../packages/server/common/models.common');

// Provider factory is mocked above; required only to wire jest.mock.
require('../../../../packages/server/integration-providers/provider-factory');

const skillInvocation = require('../../../../packages/server/ai-skill/services/skill-invocation.service');

// ── Helpers ─────────────────────────────────────────────────────────────────
const GROUP_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId();
const INTEGRATION_ID = new Types.ObjectId();
const SKILL_OID = new Types.ObjectId();

function buildSkill(overrides = {}) {
  return {
    _id: SKILL_OID,
    skillId: 'generic.text',
    status: 'ACTIVE',
    activeVersion: { major: 1, minor: 0 },
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        // Schemas live on the version now (UX review §3).
        inputSchemaId: 'genericTextInput',
        outputSchemaId: 'genericTextOutput',
        systemPrompt: 'You help.',
        skillBody: 'Reformulate.',
        inputTemplate: '<x>{{input.prompt}}</x>',
        modelHints: {},
      },
    ],
    ...overrides,
  };
}

function wireHappyPath({ skill, providerResponse } = {}) {
  LePatronSkills.findOne.mockResolvedValue(skill || buildSkill());
  Groups.findById.mockReturnValue({
    lean: () =>
      Promise.resolve({ _id: GROUP_ID, logSkillInvocationContent: true }),
  });
  AIFeatureConfigs.findOne.mockReturnValue({
    lean: () =>
      Promise.resolve({
        features: [
          {
            featureType: 'skill',
            isActive: true,
            integration: INTEGRATION_ID,
            config: { model: 'gpt-4o' },
          },
        ],
      }),
  });
  Integrations.findById.mockResolvedValue({
    _id: INTEGRATION_ID,
    provider: 'openai',
    isActive: true,
    apiKey: 'secret',
  });
  AISkillInvocations.create.mockResolvedValue({ _id: new Types.ObjectId() });
  mockProvider.chatComplete.mockResolvedValue(
    providerResponse || {
      content: JSON.stringify({ text: 'hello world' }),
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        cachedTokens: 0,
      },
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────────
describe('skill-invocation.invoke', () => {
  describe('success path', () => {
    it('returns validated output and logs a SUCCESS invocation', async () => {
      wireHappyPath();
      const result = await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'hi' },
        groupId: GROUP_ID,
        userId: USER_ID,
        invocationSource: 'demo',
      });

      expect(result.output).toEqual({ text: 'hello world' });
      expect(result.resolvedConfig.provider).toBe('openai');
      expect(result.resolvedConfig.model).toBe('gpt-4o');
      expect(result.resolvedConfig.source.model).toBe('group');
      expect(AISkillInvocations.create).toHaveBeenCalledTimes(1);
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.status).toBe('SUCCESS');
      expect(logged.skillId).toBe('generic.text');
      expect(logged.input).toEqual({ prompt: 'hi' });
      expect(logged.output).toEqual({ text: 'hello world' });
    });

    it('injects the output-format contract derived from outputSchemaId into the system message', async () => {
      wireHappyPath();
      await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'hi' },
        groupId: GROUP_ID,
        userId: USER_ID,
        invocationSource: 'demo',
      });

      const { messages } = mockProvider.chatComplete.mock.calls[0][0];
      const system = messages.find((m) => m.role === 'system');
      const user = messages.find((m) => m.role === 'user');
      expect(system.content).toContain('## Format de sortie (obligatoire)');
      expect(system.content).toContain('"text"');
      // Static section only — never inside the delimited user input.
      expect(user.content).not.toContain('Format de sortie');
    });

    it('requests native JSON mode when the provider supports it', async () => {
      wireHappyPath();
      mockProvider.supportsJsonResponseFormat = jest.fn(() => true);
      await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'hi' },
        groupId: GROUP_ID,
        userId: USER_ID,
        invocationSource: 'demo',
      });
      expect(
        mockProvider.chatComplete.mock.calls[0][0].responseFormat
      ).toEqual({ type: 'json_object' });
      delete mockProvider.supportsJsonResponseFormat;
    });

    it('omits responseFormat when the provider does not support JSON mode', async () => {
      wireHappyPath();
      mockProvider.supportsJsonResponseFormat = jest.fn(() => false);
      await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'hi' },
        groupId: GROUP_ID,
        userId: USER_ID,
        invocationSource: 'demo',
      });
      expect(
        mockProvider.chatComplete.mock.calls[0][0].responseFormat
      ).toBeUndefined();
      delete mockProvider.supportsJsonResponseFormat;
    });

    it('honors logSkillInvocationContent=false (null content)', async () => {
      wireHappyPath();
      Groups.findById.mockReturnValue({
        lean: () =>
          Promise.resolve({ _id: GROUP_ID, logSkillInvocationContent: false }),
      });
      await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'hi' },
        groupId: GROUP_ID,
      });
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.input).toBeNull();
      expect(logged.output).toBeNull();
      expect(logged.rawOutput).toBeNull();
    });

    it('executes the pinned version when params.version is provided', async () => {
      wireHappyPath({
        skill: buildSkill({
          activeVersion: { major: 2, minor: 0 },
          versions: [
            {
              versionMajor: 1,
              versionMinor: 0,
              inputSchemaId: 'genericTextInput',
              outputSchemaId: 'genericTextOutput',
              systemPrompt: 'OLD-V1-PROMPT',
              skillBody: 'Reformulate.',
              inputTemplate: '<x>{{input.prompt}}</x>',
              modelHints: {},
            },
            {
              versionMajor: 2,
              versionMinor: 0,
              inputSchemaId: 'genericTextInput',
              outputSchemaId: 'genericTextOutput',
              systemPrompt: 'NEW-V2-PROMPT',
              skillBody: 'Reformulate.',
              inputTemplate: '<x>{{input.prompt}}</x>',
              modelHints: {},
            },
          ],
        }),
      });
      await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'hi' },
        groupId: GROUP_ID,
        version: { major: 1, minor: 0 },
      });
      const { messages } = mockProvider.chatComplete.mock.calls[0][0];
      const system = messages.find((m) => m.role === 'system');
      // The PINNED version's prompt must run — not the active one.
      expect(system.content).toContain('OLD-V1-PROMPT');
      expect(system.content).not.toContain('NEW-V2-PROMPT');
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.skillVersion).toBe('1.0');
    });

    it('throws 404 when the pinned version does not exist', async () => {
      wireHappyPath();
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: { prompt: 'hi' },
          groupId: GROUP_ID,
          version: { major: 9, minor: 0 },
        })
      ).rejects.toMatchObject({ status: 404 });
      expect(mockProvider.chatComplete).not.toHaveBeenCalled();
    });

    it('strips ```json fences from raw output before parsing', async () => {
      wireHappyPath({
        providerResponse: {
          content: '```json\n{"text":"ok"}\n```',
          usage: {},
        },
      });
      const result = await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'hi' },
        groupId: GROUP_ID,
      });
      expect(result.output).toEqual({ text: 'ok' });
    });
  });

  describe('error paths', () => {
    it('honors logSkillInvocationContent=false on failure paths too', async () => {
      wireHappyPath();
      Groups.findById.mockReturnValue({
        lean: () =>
          Promise.resolve({ _id: GROUP_ID, logSkillInvocationContent: false }),
      });
      mockProvider.chatComplete.mockRejectedValue(new Error('provider down'));
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: { prompt: 'hi' },
          groupId: GROUP_ID,
        })
      ).rejects.toThrow();
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.status).toBe('PROVIDER_ERROR');
      expect(logged.input).toBeNull();
      expect(logged.rawOutput).toBeNull();
    });

    it('logs VALIDATION_ERROR and throws when input is invalid', async () => {
      wireHappyPath();
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: {
            /* missing prompt */
          },
          groupId: GROUP_ID,
        })
      ).rejects.toThrow();

      expect(mockProvider.chatComplete).not.toHaveBeenCalled();
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.status).toBe('VALIDATION_ERROR');
      expect(logged.error.code).toBe('INPUT_VALIDATION');
    });

    it('logs VALIDATION_ERROR when output does not match schema', async () => {
      wireHappyPath({
        providerResponse: {
          content: JSON.stringify({ wrong: 'shape' }),
          usage: {},
        },
      });
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: { prompt: 'hi' },
          groupId: GROUP_ID,
        })
      ).rejects.toThrow();
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.status).toBe('VALIDATION_ERROR');
      expect(logged.error.code).toBe('OUTPUT_VALIDATION');
    });

    it('logs VALIDATION_ERROR when raw output is not valid JSON', async () => {
      wireHappyPath({
        providerResponse: { content: 'plain text reply', usage: {} },
      });
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: { prompt: 'hi' },
          groupId: GROUP_ID,
        })
      ).rejects.toThrow();
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.error.code).toBe('OUTPUT_PARSE');
    });

    it('logs PROVIDER_ERROR when provider throws', async () => {
      wireHappyPath();
      mockProvider.chatComplete.mockRejectedValue(
        Object.assign(new Error('boom'), { code: 'API_ERROR' })
      );
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: { prompt: 'hi' },
          groupId: GROUP_ID,
        })
      ).rejects.toThrow();
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.status).toBe('PROVIDER_ERROR');
    });

    it('logs TIMEOUT when the provider call exceeds timeoutMs', async () => {
      wireHappyPath();
      mockProvider.chatComplete.mockImplementation(
        () => new Promise(() => {}) // never resolves
      );
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: { prompt: 'hi' },
          groupId: GROUP_ID,
          options: { timeoutMs: 20 },
        })
      ).rejects.toThrow();
      const logged = AISkillInvocations.create.mock.calls[0][0];
      expect(logged.status).toBe('TIMEOUT');
    });

    it('throws 404 when the skill is not ACTIVE / not found', async () => {
      LePatronSkills.findOne.mockResolvedValue(null);
      await expect(
        skillInvocation.invoke({
          skillId: 'nope',
          input: { prompt: 'x' },
          groupId: GROUP_ID,
        })
      ).rejects.toThrow(/not found/);
    });

    it('throws when the Group has no skill feature configured', async () => {
      LePatronSkills.findOne.mockResolvedValue(buildSkill());
      Groups.findById.mockReturnValue({
        lean: () => Promise.resolve({ _id: GROUP_ID }),
      });
      AIFeatureConfigs.findOne.mockReturnValue({
        lean: () => Promise.resolve({ features: [] }),
      });
      await expect(
        skillInvocation.invoke({
          skillId: 'generic.text',
          input: { prompt: 'x' },
          groupId: GROUP_ID,
        })
      ).rejects.toThrow(/skill/);
    });

    // Schemas live in code while versions store only their id, so a rename or a
    // deletion leaves ACTIVE versions pointing at nothing. Both ids must fail
    // before the provider is called, or the billed request is wasted.
    it.each([
      ['inputSchemaId', /unknown input schema/],
      ['outputSchemaId', /unknown output schema/],
    ])(
      'throws before calling the provider when %s no longer resolves',
      async (field, message) => {
        const skill = buildSkill();
        skill.versions[0][field] = 'schemaRenamedAway';
        wireHappyPath({ skill });

        await expect(
          skillInvocation.invoke({
            skillId: 'generic.text',
            input: { prompt: 'x' },
            groupId: GROUP_ID,
          })
        ).rejects.toThrow(message);
        expect(mockProvider.chatComplete).not.toHaveBeenCalled();
      }
    );
  });

  describe('dryRun', () => {
    it('returns built messages without calling the provider or logging', async () => {
      wireHappyPath();
      const out = await skillInvocation.invoke({
        skillId: 'generic.text',
        input: { prompt: 'x' },
        groupId: GROUP_ID,
        options: { dryRun: true },
      });
      expect(out.messages).toBeDefined();
      expect(mockProvider.chatComplete).not.toHaveBeenCalled();
      expect(AISkillInvocations.create).not.toHaveBeenCalled();
    });
  });
});
