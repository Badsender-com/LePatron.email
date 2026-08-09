'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  AIPlaygroundScenarios: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  },
  AIPlaygroundRuns: { deleteMany: jest.fn(), aggregate: jest.fn() },
  LePatronSkills: { findOne: jest.fn() },
  Expertises: { findOne: jest.fn() },
}));

const scenarioService = require('../../../../packages/server/ai-playground/services/scenario.service');
const {
  AIPlaygroundScenarios,
  AIPlaygroundRuns,
  LePatronSkills,
} = require('../../../../packages/server/common/models.common');

function mockSkillLean(value) {
  LePatronSkills.findOne.mockReturnValue({
    lean: () => Promise.resolve(value),
  });
}
// Expertises is mocked at the top of the file; its findOne is reachable via
// `Expertises.findOne` when a test needs to seed an expertise. Not used by
// the current cases but kept available for future ones.

beforeEach(() => jest.clearAllMocks());

describe('scenario.service', () => {
  describe('listScenarios', () => {
    it('decorates each scenario with lastRunAt / lastRunStatus / runCount', async () => {
      const id = new Types.ObjectId();
      AIPlaygroundScenarios.find.mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([{ _id: id, scenarioId: 's1' }]),
            }),
          }),
        }),
      });
      AIPlaygroundScenarios.countDocuments.mockResolvedValue(1);
      AIPlaygroundRuns.aggregate.mockResolvedValue([
        {
          _id: id,
          lastRunAt: new Date(0),
          lastRunStatus: 'SUCCESS',
          runCount: 3,
        },
      ]);
      const res = await scenarioService.listScenarios({});
      expect(res.items[0].runCount).toBe(3);
      expect(res.items[0].lastRunStatus).toBe('SUCCESS');
      expect(res.items[0].lastRunAt).toBeInstanceOf(Date);
    });

    it('sets zero/null decoration for a scenario with no runs', async () => {
      const id = new Types.ObjectId();
      AIPlaygroundScenarios.find.mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([{ _id: id, scenarioId: 's1' }]),
            }),
          }),
        }),
      });
      AIPlaygroundScenarios.countDocuments.mockResolvedValue(1);
      AIPlaygroundRuns.aggregate.mockResolvedValue([]);
      const res = await scenarioService.listScenarios({});
      expect(res.items[0].runCount).toBe(0);
      expect(res.items[0].lastRunStatus).toBeNull();
      expect(res.items[0].lastRunAt).toBeNull();
    });
  });

  describe('createScenario', () => {
    it('throws 400 when the referenced skill does not exist', async () => {
      mockSkillLean(null);
      await expect(
        scenarioService.createScenario(
          { scenarioId: 'a', name: 'a', skillRef: { skillId: 'nope' } },
          null
        )
      ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when the referenced skill is not ACTIVE', async () => {
      mockSkillLean({ skillId: 's', status: 'DRAFT', versions: [] });
      await expect(
        scenarioService.createScenario(
          { scenarioId: 'a', name: 'a', skillRef: { skillId: 's' } },
          null
        )
      ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when a pinned skill version does not exist', async () => {
      mockSkillLean({
        skillId: 's',
        status: 'ACTIVE',
        activeVersion: { major: 1, minor: 0 },
        versions: [{ versionMajor: 1, versionMinor: 0 }],
      });
      await expect(
        scenarioService.createScenario(
          {
            scenarioId: 'a',
            name: 'a',
            skillRef: {
              skillId: 's',
              mode: 'pinned',
              versionMajor: 9,
              versionMinor: 0,
            },
          },
          null
        )
      ).rejects.toMatchObject({ status: 400 });
    });

    it('creates when references are valid', async () => {
      mockSkillLean({
        skillId: 's',
        status: 'ACTIVE',
        activeVersion: { major: 1, minor: 0 },
        versions: [{ versionMajor: 1, versionMinor: 0 }],
      });
      AIPlaygroundScenarios.create.mockResolvedValue({ scenarioId: 'a' });
      const userId = new Types.ObjectId();
      await scenarioService.createScenario(
        { scenarioId: 'a', name: 'a', skillRef: { skillId: 's' } },
        userId
      );
      const payload = AIPlaygroundScenarios.create.mock.calls[0][0];
      expect(payload.owner).toBe(userId);
      expect(payload.updatedBy).toBe(userId);
    });

    it('rethrows 409 on duplicate scenarioId', async () => {
      mockSkillLean({
        skillId: 's',
        status: 'ACTIVE',
        activeVersion: { major: 1, minor: 0 },
        versions: [{ versionMajor: 1, versionMinor: 0 }],
      });
      AIPlaygroundScenarios.create.mockRejectedValue({ code: 11000 });
      await expect(
        scenarioService.createScenario(
          { scenarioId: 'a', name: 'a', skillRef: { skillId: 's' } },
          null
        )
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('deleteScenario', () => {
    it('removes the scenario and its runs', async () => {
      const oid = new Types.ObjectId();
      AIPlaygroundScenarios.findOne.mockResolvedValue({
        _id: oid,
        toObject() {
          return { _id: oid };
        },
      });
      AIPlaygroundRuns.deleteMany.mockResolvedValue({});
      AIPlaygroundScenarios.deleteOne.mockResolvedValue({});
      await scenarioService.deleteScenario('a');
      expect(AIPlaygroundRuns.deleteMany).toHaveBeenCalledWith({
        _scenario: oid,
      });
      expect(AIPlaygroundScenarios.deleteOne).toHaveBeenCalledWith({
        _id: oid,
      });
    });
  });
});
