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
        },
        userId
      );
      const payload = LePatronSkills.create.mock.calls[0][0];
      expect(payload.status).toBe('DRAFT');
      expect(payload.owner).toBe(userId);
      expect(payload.activeVersion).toEqual({ major: null, minor: 0 });
    });

    it('seeds a v1.0 DRAFT with the generic schemas pre-filled (§B1)', async () => {
      LePatronSkills.create.mockResolvedValue({ skillId: 'a' });
      await skillService.createSkill(
        { skillId: 'redaction.cta', title: 't', category: 'redaction' },
        new Types.ObjectId()
      );
      const payload = LePatronSkills.create.mock.calls[0][0];
      expect(payload.versions).toHaveLength(1);
      const [v] = payload.versions;
      expect(v.versionMajor).toBe(1);
      expect(v.versionMinor).toBe(0);
      expect(v.status).toBe('DRAFT');
      expect(v.inputSchemaId).toBe('genericTextInput');
      expect(v.outputSchemaId).toBe('genericTextOutput');
    });

    it('throws 409 on duplicate skillId', async () => {
      LePatronSkills.create.mockRejectedValue({ code: 11000 });
      await expect(
        skillService.createSkill({ skillId: 'a' }, null)
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('updateSkill', () => {
    it('patches title/description/category (schemas are versioned, not here)', async () => {
      const doc = mockSkillDoc({ title: 'old' });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.updateSkill('generic.text', {
        title: 'new',
        // schemas are no longer skill-level — ignored here
        inputSchemaId: 'genericTextOutput',
      });
      expect(doc.title).toBe('new');
      expect(doc.inputSchemaId).toBeUndefined();
      expect(doc.save).toHaveBeenCalled();
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

  // Anti-bug-class: every version-creation path that copies from a source MUST
  // reproduce ALL content fields. Driven by the same exported list the service
  // clones from, so a newly-added content field is covered automatically —
  // this is the test that would have caught inputSchemaId/outputSchemaId being
  // dropped after the §3 migration.
  describe('version content cloning (all fields, all paths)', () => {
    const { VERSION_CONTENT_FIELDS } = skillService;

    function distinctiveValue(field) {
      if (field.deep) {
        const empty = field.default();
        return Array.isArray(empty)
          ? [{ marker: field.name }]
          : { marker: field.name };
      }
      return `val-${field.name}`;
    }

    function makeSource(overrides = {}) {
      const source = {
        versionMajor: 1,
        versionMinor: 0,
        status: 'ACTIVE',
        ...overrides,
      };
      for (const field of VERSION_CONTENT_FIELDS) {
        source[field.name] = distinctiveValue(field);
      }
      return source;
    }

    function expectAllContentCopied(created, source) {
      for (const field of VERSION_CONTENT_FIELDS) {
        expect(created[field.name]).toEqual(source[field.name]);
      }
    }

    it('sanity: the list is non-empty and includes the versioned schemas', () => {
      const names = VERSION_CONTENT_FIELDS.map((f) => f.name);
      expect(names).toEqual(
        expect.arrayContaining(['inputSchemaId', 'outputSchemaId'])
      );
    });

    it('minor version copies all content fields from the active version', async () => {
      const source = makeSource();
      const doc = mockSkillDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [source],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.createMinorVersion('a', null);
      expectAllContentCopied(doc.versions[doc.versions.length - 1], source);
    });

    it('major version copies all content fields from the active version', async () => {
      const source = makeSource();
      const doc = mockSkillDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [source],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.createMajorVersion('a', { userId: null });
      expectAllContentCopied(doc.versions[doc.versions.length - 1], source);
    });

    it('duplicate copies all content fields from an arbitrary source version', async () => {
      const source = makeSource({ versionMajor: 1, status: 'ARCHIVED' });
      const doc = mockSkillDoc({
        activeVersion: { major: 2, minor: 0 },
        versions: [
          source,
          { versionMajor: 2, versionMinor: 0, status: 'ACTIVE' },
        ],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await skillService.createMajorVersion('a', { source, userId: null });
      expectAllContentCopied(doc.versions[doc.versions.length - 1], source);
    });

    it('seed path (createSkill) carries every content field', async () => {
      LePatronSkills.create.mockResolvedValue({ skillId: 'a' });
      await skillService.createSkill(
        { skillId: 'a', title: 't', category: 'redaction' },
        new Types.ObjectId()
      );
      const [seeded] = LePatronSkills.create.mock.calls[0][0].versions;
      for (const field of VERSION_CONTENT_FIELDS) {
        expect(seeded[field.name]).toBeDefined();
      }
      expect(seeded.inputSchemaId).toBe('genericTextInput');
      expect(seeded.outputSchemaId).toBe('genericTextOutput');
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

  const SCHEMAS = {
    inputSchemaId: 'genericTextInput',
    outputSchemaId: 'genericTextOutput',
  };

  describe('activateVersion', () => {
    it('requires the version schemas to be set before publishing', async () => {
      const doc = mockSkillDoc({
        versions: [{ versionMajor: 2, versionMinor: 0, status: 'DRAFT' }],
      });
      LePatronSkills.findOne.mockResolvedValue(doc);
      await expect(
        skillService.activateVersion('a', { major: 2, minor: 0 }, {}, null)
      ).rejects.toMatchObject({
        status: 400,
        message: 'SKILL_SCHEMAS_REQUIRED_TO_PUBLISH',
      });
    });

    it('requires changelog + releaseNotes for a major release', async () => {
      const doc = mockSkillDoc({
        versions: [
          { versionMajor: 2, versionMinor: 0, status: 'DRAFT', ...SCHEMAS },
        ],
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
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE', ...SCHEMAS },
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            ...SCHEMAS,
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
        versions: [
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            ...SCHEMAS,
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
        // The offending fields travel as data so the UI can word the sentence.
        message: 'SKILL_TEMPLATE_UNKNOWN_FIELDS',
        schemaId: 'genericTextInput',
        fields: ['brief'],
      });
      expect(doc.versions[0].status).toBe('DRAFT');
    });

    it('activates when the template matches the input schema', async () => {
      const doc = mockSkillDoc({
        versions: [
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            ...SCHEMAS,
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
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE', ...SCHEMAS },
          { versionMajor: 2, versionMinor: 0, status: 'DRAFT', ...SCHEMAS },
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
