'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  AIPlaygroundScenarios: { findOne: jest.fn() },
  AIPlaygroundRuns: { create: jest.fn() },
  LePatronSkills: { findOne: jest.fn() },
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

  it('refuses when neither scenario.groupContext nor groupId is provided', async () => {
    AIPlaygroundScenarios.findOne.mockResolvedValue(
      mockScenario({ groupContext: null })
    );
    await expect(
      executeScenario({ scenarioId: 'demo', userId: USER_ID })
    ).rejects.toMatchObject({ status: 400 });
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
