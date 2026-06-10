'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  AIPlaygroundScenarios: { findOne: jest.fn() },
  AIPlaygroundRuns: { create: jest.fn() },
  LePatronSkills: { findOne: jest.fn() },
  Groups: { findOne: jest.fn() },
  // Used by run.service tests (irrelevant here, but the import chain reaches it)
  AIPlaygroundScenarios_dummy: undefined,
}));
jest.mock(
  '../../../../packages/server/ai-skill/services/skill-invocation.service',
  () => ({ invoke: jest.fn() })
);
jest.mock(
  '../../../../packages/server/ai-skill/services/test-budget.service',
  () => ({ consumeBudget: jest.fn() })
);
jest.mock(
  '../../../../packages/server/ai-playground/services/expertise-resolver.service',
  () => ({ resolveExpertise: jest.fn() })
);

const {
  executeScenario,
} = require('../../../../packages/server/ai-playground/services/playground-runner.service');
const {
  AIPlaygroundScenarios,
  AIPlaygroundRuns,
  LePatronSkills,
  Groups,
} = require('../../../../packages/server/common/models.common');
const skillInvocation = require('../../../../packages/server/ai-skill/services/skill-invocation.service');
const testBudget = require('../../../../packages/server/ai-skill/services/test-budget.service');
const {
  resolveExpertise,
} = require('../../../../packages/server/ai-playground/services/expertise-resolver.service');

const SCENARIO_OID = new Types.ObjectId();
const GROUP_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId();

function mockScenario(overrides = {}) {
  const obj = {
    _id: SCENARIO_OID,
    scenarioId: 'demo',
    skillRef: { skillId: 'generic.text', mode: 'active' },
    expertiseRefs: [],
    expertiseFilter: { scope: [], emailType: null, language: null },
    input: { prompt: 'hi' },
    providerOverride: {},
    groupContext: GROUP_ID,
    variantPath: [],
    ...overrides,
  };
  return {
    ...obj,
    toObject() {
      return obj;
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  AIPlaygroundRuns.create.mockImplementation(async (doc) => ({
    _id: new Types.ObjectId(),
    ...doc,
  }));
});

describe('playground-runner.executeScenario', () => {
  it('runs the happy path: resolves skill+expertise, invokes, creates a SUCCESS run', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(mockScenario());
    LePatronSkills.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          skillId: 'generic.text',
          status: 'ACTIVE',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        }),
    });
    resolveExpertise.mockResolvedValue([
      {
        expertiseId: 'e1',
        title: 'E1',
        body: 'b',
        examplesGood: [],
        examplesBad: [],
        versionMajor: 1,
        versionMinor: 0,
      },
    ]);
    skillInvocation.invoke.mockResolvedValue({
      output: { text: 'ok' },
      invocationId: new Types.ObjectId(),
      tokenUsage: { promptTokens: 5, completionTokens: 3 },
      latencyMs: 42,
    });

    const run = await executeScenario({
      scenarioId: 'demo',
      userId: USER_ID,
    });

    expect(testBudget.consumeBudget).toHaveBeenCalledWith(USER_ID);
    expect(skillInvocation.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: 'generic.text',
        featureType: 'playground',
        groupId: GROUP_ID,
        userId: USER_ID,
      })
    );
    const composedInput = skillInvocation.invoke.mock.calls[0][0].input;
    expect(composedInput.prompt).toBe('hi');
    expect(composedInput.expertise).toHaveLength(1);
    expect(composedInput.expertise[0].body).toBe('b');

    expect(run.status).toBe('SUCCESS');
    expect(run.resolvedSkill).toEqual({
      skillId: 'generic.text',
      versionMajor: 1,
      versionMinor: 0,
    });
    expect(run.resolvedExpertise).toEqual([
      { expertiseId: 'e1', versionMajor: 1, versionMinor: 0 },
    ]);
  });

  it('does not inject an empty expertise key when no expertise resolves', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(mockScenario());
    LePatronSkills.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          skillId: 'generic.text',
          status: 'ACTIVE',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        }),
    });
    resolveExpertise.mockResolvedValue([]);
    skillInvocation.invoke.mockResolvedValue({
      output: { text: 'ok' },
      invocationId: new Types.ObjectId(),
      tokenUsage: {},
      latencyMs: 1,
    });

    await executeScenario({ scenarioId: 'demo', userId: USER_ID });

    const composedInput = skillInvocation.invoke.mock.calls[0][0].input;
    // No expertise → the runner must not pollute the input with `expertise`,
    // which would break a strict skill schema (e.g. generic.text).
    expect('expertise' in composedInput).toBe(false);
    expect(composedInput.prompt).toBe('hi');
  });

  it('carries transient fieldErrors and humanizes the persisted errorMessage', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(mockScenario());
    LePatronSkills.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          skillId: 'generic.text',
          status: 'ACTIVE',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        }),
    });
    resolveExpertise.mockResolvedValue([]);
    const validationError = Object.assign(
      new Error('prompt: Invalid input: expected string, received undefined'),
      {
        invocationStatus: 'VALIDATION_ERROR',
        fieldErrors: [
          { field: 'prompt', issue: 'required' },
          { field: 'brief', issue: 'unrecognized' },
        ],
      }
    );
    skillInvocation.invoke.mockRejectedValue(validationError);

    const run = await executeScenario({ scenarioId: 'demo', userId: USER_ID });

    expect(run.status).toBe('VALIDATION_ERROR');
    // Transient property for the execute controller, never in the create doc.
    expect(run.fieldErrors).toEqual(validationError.fieldErrors);
    expect(
      AIPlaygroundRuns.create.mock.calls[0][0].fieldErrors
    ).toBeUndefined();
    // Persisted message is the humanized summary, not the raw zod message.
    expect(AIPlaygroundRuns.create.mock.calls[0][0].errorMessage).toBe(
      'Champs invalides : prompt (obligatoire) ; brief (non reconnu par cette skill)'
    );
  });

  it('keeps the raw message for non-validation errors', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(mockScenario());
    LePatronSkills.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          skillId: 'generic.text',
          status: 'ACTIVE',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        }),
    });
    resolveExpertise.mockResolvedValue([]);
    skillInvocation.invoke.mockRejectedValue(
      Object.assign(new Error('Provider timeout'), {
        invocationStatus: 'TIMEOUT',
      })
    );

    const run = await executeScenario({ scenarioId: 'demo', userId: USER_ID });

    expect(run.errorMessage).toBe('Provider timeout');
    expect(run.fieldErrors).toBeUndefined();
  });

  it('refuses when no group context and no platform group exists', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(
      mockScenario({ groupContext: null })
    );
    Groups.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    await expect(
      executeScenario({ scenarioId: 'demo', userId: USER_ID })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('falls back to the platform group when no group context is provided', async () => {
    const PLATFORM_OID = new Types.ObjectId();
    AIPlaygroundScenarios.findOne.mockResolvedValue(
      mockScenario({ groupContext: null })
    );
    Groups.findOne.mockReturnValue({
      lean: () => Promise.resolve({ _id: PLATFORM_OID }),
    });
    LePatronSkills.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          skillId: 'generic.text',
          status: 'ACTIVE',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        }),
    });
    resolveExpertise.mockResolvedValue([]);
    skillInvocation.invoke.mockResolvedValue({
      output: { text: 'ok' },
      invocationId: new Types.ObjectId(),
      tokenUsage: {},
      latencyMs: 1,
    });

    await executeScenario({ scenarioId: 'demo', userId: USER_ID });

    expect(skillInvocation.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: PLATFORM_OID })
    );
  });

  it('throws 404 when the scenario does not exist', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(null);
    await expect(
      executeScenario({ scenarioId: 'missing', userId: USER_ID })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 404 when the pinned skill version does not exist', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(
      mockScenario({
        skillRef: {
          skillId: 'generic.text',
          mode: 'pinned',
          versionMajor: 9,
          versionMinor: 0,
        },
      })
    );
    LePatronSkills.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          skillId: 'generic.text',
          status: 'ACTIVE',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        }),
    });
    await expect(
      executeScenario({ scenarioId: 'demo', userId: USER_ID })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('still creates a run reflecting the error when the invocation fails', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(mockScenario());
    LePatronSkills.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          skillId: 'generic.text',
          status: 'ACTIVE',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        }),
    });
    resolveExpertise.mockResolvedValue([]);
    skillInvocation.invoke.mockRejectedValue(
      Object.assign(new Error('LLM down'), {
        invocationStatus: 'PROVIDER_ERROR',
      })
    );

    const run = await executeScenario({
      scenarioId: 'demo',
      userId: USER_ID,
    });
    expect(run.status).toBe('PROVIDER_ERROR');
    expect(run.errorMessage).toBe('LLM down');
    expect(run.output).toBeNull();
  });
});
