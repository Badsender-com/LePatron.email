'use strict';

const { Types } = require('mongoose');

jest.mock('../../../../packages/server/common/models.common', () => ({
  LePatronSkills: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}));

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const {
  LePatronSkills,
} = require('../../../../packages/server/common/models.common');

function mockChainable(value) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
  return chain;
}

function mockSkillDoc(overrides = {}) {
  const doc = {
    skillId: 'generic.text',
    title: 't',
    status: 'DRAFT',
    activeVersion: null,
    versions: [],
    save: jest.fn().mockImplementation(async function () {
      return this;
    }),
    ...overrides,
  };
  return doc;
}

beforeEach(() => jest.clearAllMocks());

describe('skill.service', () => {
  describe('listSkills', () => {
    it('applies filters and pagination', async () => {
      LePatronSkills.find.mockReturnValue(mockChainable([{ skillId: 'a' }]));
      LePatronSkills.countDocuments.mockResolvedValue(1);
      const result = await skillService.listSkills({
        category: 'redaction',
        status: 'ACTIVE',
        page: 2,
        pageSize: 10,
      });
      expect(LePatronSkills.find).toHaveBeenCalledWith(
        { category: 'redaction', status: 'ACTIVE' },
        expect.any(Object)
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('createSkill', () => {
    it('creates with DRAFT status and userId owner', async () => {
      const userId = new Types.ObjectId();
      LePatronSkills.create.mockResolvedValue({ skillId: 'a' });
      await skillService.createSkill(
        {
          skillId: 'redaction.cta',
          title: 't',
          category: 'redaction',
          inputSchemaId: 'genericTextInput',
          outputSchemaId: 'genericTextOutput',
        },
        userId
      );
      const payload = LePatronSkills.create.mock.calls[0][0];
      expect(payload.status).toBe('DRAFT');
      expect(payload.owner).toBe(userId);
      expect(payload.versions).toEqual([]);
    });

    it('throws 409 on duplicate skillId', async () => {
      LePatronSkills.create.mockRejectedValue({ code: 11000 });
      await expect(
        skillService.createSkill({ skillId: 'a' }, null)
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('createVersion', () => {
    it('assigns the next versionNumber', async () => {
      const doc = mockSkillDoc({
        versions: [{ versionNumber: 1 }, { versionNumber: 3 }],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.createVersion('a', { systemPrompt: 'hi' }, null);
      expect(doc.versions[2].versionNumber).toBe(4);
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe('updateVersion', () => {
    it('rejects edits on activated versions without changelog', async () => {
      const doc = mockSkillDoc({
        versions: [{ versionNumber: 1, activatedAt: new Date() }],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.updateVersion('a', 1, { skillBody: 'x' }, null)
      ).rejects.toMatchObject({ status: 400 });
    });

    it('accepts edits on activated versions when a changelog is provided', async () => {
      const doc = mockSkillDoc({
        versions: [
          { versionNumber: 1, skillBody: 'old', activatedAt: new Date() },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.updateVersion(
        'a',
        1,
        { skillBody: 'new', changelog: 'tighten wording' },
        null
      );
      expect(doc.versions[0].skillBody).toBe('new');
      expect(doc.versions[0].changelog).toBe('tighten wording');
    });

    it('updates DRAFT version fields', async () => {
      const doc = mockSkillDoc({
        versions: [{ versionNumber: 1, skillBody: 'old' }],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.updateVersion('a', 1, { skillBody: 'new' }, null);
      expect(doc.versions[0].skillBody).toBe('new');
    });
  });

  describe('activateVersion', () => {
    it('requires changelog and releaseNotes', async () => {
      const doc = mockSkillDoc({ versions: [{ versionNumber: 1 }] });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.activateVersion('a', 1, {}, null)
      ).rejects.toMatchObject({ status: 400 });
    });

    it('flips skill status to ACTIVE and stamps activatedAt', async () => {
      const doc = mockSkillDoc({ versions: [{ versionNumber: 1 }] });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.activateVersion(
        'a',
        1,
        { changelog: 'c', releaseNotes: 'r' },
        null
      );
      expect(doc.status).toBe('ACTIVE');
      expect(doc.activeVersion).toBe(1);
      expect(doc.versions[0].activatedAt).toBeInstanceOf(Date);
    });
  });

  describe('archiveSkill', () => {
    it('flips status to ARCHIVED', async () => {
      const doc = mockSkillDoc({ status: 'ACTIVE' });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.archiveSkill('a');
      expect(doc.status).toBe('ARCHIVED');
    });
  });
});
