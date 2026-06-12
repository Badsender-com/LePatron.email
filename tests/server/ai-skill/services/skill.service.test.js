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
    activeVersion: { major: null, minor: 0 },
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
      expect(payload.activeVersion).toEqual({ major: null, minor: 0 });
    });

    it('throws 409 on duplicate skillId', async () => {
      LePatronSkills.create.mockRejectedValue({ code: 11000 });
      await expect(
        skillService.createSkill({ skillId: 'a' }, null)
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('updateSkill', () => {
    it('refuses an inputSchemaId change incoherent with the ACTIVE template', async () => {
      // Active template references {{input.prompt}}; genericTextOutput has no
      // `prompt` field — the activation gate must not be bypassable via PATCH.
      LePatronSkills.findOne.mockResolvedValue(
        mockSkillDoc({
          status: 'ACTIVE',
          inputSchemaId: 'genericTextInput',
          activeVersion: { major: 1, minor: 0 },
          versions: [
            {
              versionMajor: 1,
              versionMinor: 0,
              status: 'ACTIVE',
              inputTemplate: '<x>{{input.prompt}}</x>',
            },
          ],
        })
      );
      await expect(
        skillService.updateSkill('generic.text', {
          inputSchemaId: 'genericTextOutput',
        })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('accepts an inputSchemaId change coherent with the ACTIVE template', async () => {
      const doc = mockSkillDoc({
        status: 'ACTIVE',
        inputSchemaId: 'genericTextOutput',
        activeVersion: { major: 1, minor: 0 },
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'ACTIVE',
            inputTemplate: '<x>{{input.prompt}}</x>',
          },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.updateSkill('generic.text', {
        inputSchemaId: 'genericTextInput',
      });
      expect(doc.save).toHaveBeenCalled();
      expect(doc.inputSchemaId).toBe('genericTextInput');
    });
  });

  describe('createMajorVersion', () => {
    it('starts a fresh major draft when the skill has no versions', async () => {
      const doc = mockSkillDoc();
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.createMajorVersion('a', { userId: null });
      expect(doc.versions).toHaveLength(1);
      expect(doc.versions[0].versionMajor).toBe(1);
      expect(doc.versions[0].versionMinor).toBe(0);
      expect(doc.versions[0].status).toBe('DRAFT');
      expect(doc.versions[0].changelog).toBe('');
    });

    it('bumps the major number and clones the active content', async () => {
      const doc = mockSkillDoc({
        activeVersion: { major: 2, minor: 1 },
        versions: [
          { versionMajor: 1, versionMinor: 0, status: 'ARCHIVED' },
          {
            versionMajor: 2,
            versionMinor: 0,
            status: 'ARCHIVED',
            skillBody: 'old',
          },
          {
            versionMajor: 2,
            versionMinor: 1,
            status: 'ACTIVE',
            skillBody: 'active body',
          },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.createMajorVersion('a', { userId: null });
      const created = doc.versions[doc.versions.length - 1];
      expect(created.versionMajor).toBe(3);
      expect(created.versionMinor).toBe(0);
      expect(created.skillBody).toBe('active body');
    });
  });

  describe('createMinorVersion', () => {
    it('refuses when there is no active version', async () => {
      const doc = mockSkillDoc();
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.createMinorVersion('a', null)
      ).rejects.toMatchObject({ status: 400 });
    });

    it('increments the minor on top of the active version and pre-fills changelog', async () => {
      const doc = mockSkillDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'ACTIVE',
            skillBody: 'body',
          },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.createMinorVersion('a', null);
      const created = doc.versions[doc.versions.length - 1];
      expect(created.versionMajor).toBe(1);
      expect(created.versionMinor).toBe(1);
      expect(created.status).toBe('DRAFT');
      expect(created.skillBody).toBe('body');
      expect(created.changelog).toBe('Correction mineure');
      expect(created.releaseNotes).toMatch(/Correction mineure/);
    });
  });

  describe('updateVersion', () => {
    it('rejects edits on non-DRAFT versions', async () => {
      const doc = mockSkillDoc({
        versions: [
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' },
          { versionMajor: 1, versionMinor: 1, status: 'ARCHIVED' },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.updateVersion(
          'a',
          { major: 1, minor: 0 },
          { skillBody: 'x' },
          null
        )
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        skillService.updateVersion(
          'a',
          { major: 1, minor: 1 },
          { skillBody: 'x' },
          null
        )
      ).rejects.toMatchObject({ status: 409 });
    });

    it('updates DRAFT fields and stamps updatedAt/updatedBy', async () => {
      const userId = new Types.ObjectId();
      const doc = mockSkillDoc({
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'DRAFT',
            skillBody: 'old',
          },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.updateVersion(
        'a',
        { major: 1, minor: 0 },
        { skillBody: 'new' },
        userId
      );
      expect(doc.versions[0].skillBody).toBe('new');
      expect(doc.versions[0].updatedBy).toBe(userId);
      expect(doc.versions[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteVersion', () => {
    it('removes a DRAFT version from the versions array', async () => {
      const doc = mockSkillDoc({
        versions: [
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' },
          { versionMajor: 1, versionMinor: 1, status: 'DRAFT' },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.deleteVersion('a', { major: 1, minor: 1 });
      expect(doc.versions).toHaveLength(1);
      expect(doc.versions[0].versionMinor).toBe(0);
    });

    it('refuses to delete a non-DRAFT version', async () => {
      const doc = mockSkillDoc({
        versions: [{ versionMajor: 1, versionMinor: 0, status: 'ACTIVE' }],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.deleteVersion('a', { major: 1, minor: 0 })
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('activateVersion', () => {
    it('requires changelog + releaseNotes for a major release', async () => {
      const doc = mockSkillDoc({
        versions: [{ versionMajor: 2, versionMinor: 0, status: 'DRAFT' }],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.activateVersion('a', { major: 2, minor: 0 }, {}, null)
      ).rejects.toMatchObject({ status: 400 });
    });

    it('accepts a minor release without payload (defaults from createMinor)', async () => {
      const doc = mockSkillDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' },
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            changelog: 'Correction mineure',
            releaseNotes: 'Correction mineure sans changement de doctrine.',
          },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.activateVersion('a', { major: 1, minor: 1 }, {}, null);
      const active = doc.versions.find((v) => v.status === 'ACTIVE');
      expect(active.versionMinor).toBe(1);
      const archived = doc.versions.find((v) => v.status === 'ARCHIVED');
      expect(archived.versionMinor).toBe(0);
      expect(doc.activeVersion).toEqual({ major: 1, minor: 1 });
    });

    it('blocks activation when the template references out-of-schema fields', async () => {
      const doc = mockSkillDoc({
        inputSchemaId: 'genericTextInput',
        versions: [
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            inputTemplate: '<brief>{{input.brief}}</brief>',
            changelog: 'c',
            releaseNotes: 'r',
          },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.activateVersion('a', { major: 1, minor: 1 }, {}, null)
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('brief'),
      });
      expect(doc.versions[0].status).toBe('DRAFT');
    });

    it('activates when the template matches the input schema', async () => {
      const doc = mockSkillDoc({
        inputSchemaId: 'genericTextInput',
        versions: [
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            inputTemplate: '{{input.prompt}} {{input.context}}',
            changelog: 'c',
            releaseNotes: 'r',
          },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.activateVersion('a', { major: 1, minor: 1 }, {}, null);
      expect(doc.versions[0].status).toBe('ACTIVE');
    });

    it('archives the previously active version on activation', async () => {
      const doc = mockSkillDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' },
          { versionMajor: 2, versionMinor: 0, status: 'DRAFT' },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.activateVersion(
        'a',
        { major: 2, minor: 0 },
        { changelog: 'c', releaseNotes: 'r' },
        null
      );
      expect(doc.versions[0].status).toBe('ARCHIVED');
      expect(doc.versions[1].status).toBe('ACTIVE');
      expect(doc.activeVersion).toEqual({ major: 2, minor: 0 });
      expect(doc.status).toBe('ACTIVE');
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
