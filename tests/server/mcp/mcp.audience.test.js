/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The audience of a skill or an expertise (ADR 0013): the platform company
// only, or all companies. A new one starts with the platform company, where it
// is proven before it is opened; a client never reads it until then, nor one
// that has no audience yet, until the migration opens it.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const { ROLES } = require('../../../packages/shared/access/roles.js');

const DRAFT_SHEET = 'design.draft-guidelines';
const PROVING = {
  _id: '507f1f77bcf86cd799439805',
  expertiseId: DRAFT_SHEET,
  title: 'Draft guidelines',
  category: 'design',
  scope: ['subject', 'spacing'],
  isTransversal: false,
  appliesToEmailTypes: [],
  appliesToLanguages: [],
  status: 'ACTIVE',
  audience: 'platform',
  activeVersion: { major: 1, minor: 0 },
  versions: [
    {
      versionMajor: 1,
      versionMinor: 0,
      status: 'ACTIVE',
      body: '## Spacing\n\nA rule still being proven.',
      examplesGood: [],
      examplesBad: [],
      updatedAt: f.daysFrom(-1),
    },
  ],
};
const PROVING_SKILL = {
  ...f.SKILLS[0],
  _id: '507f1f77bcf86cd799439905',
  skillId: 'qc.checklist-review',
  title: 'Review an email against a checklist',
  audience: 'platform',
};
// A task skill open to every group that consumes an expertise still proven.
const CONSUMING_TASK = {
  _id: '507f1f77bcf86cd799439906',
  skillId: 'qc.spacing-review',
  title: 'Review the spacing',
  category: 'qc',
  status: 'ACTIVE',
  audience: 'all',
  activeVersion: { major: 1, minor: 0 },
  versions: [
    {
      versionMajor: 1,
      versionMinor: 0,
      status: 'ACTIVE',
      nature: 'task',
      procedure: 'Check the spacing.',
      consumedExpertiseIds: ['redaction.subject-line', DRAFT_SHEET],
    },
  ],
};
const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;

// A member of each role, in the platform company and in a client company. A
// super admin always belongs to the platform company (ADR 0002): in a client
// company, it is one whose connection is bound to that company.
const PLATFORM_MEMBERS = Object.values(ROLES)
  .filter((role) => role !== ROLES.SUPER_ADMIN)
  .map((role, i) => ({
    _id: `507f1f77bcf86cd7994396${String(i).padStart(2, '0')}`,
    name: `Platform ${role}`,
    email: `platform-${role}@example.test`,
    lang: 'en',
    role,
    _company: f.PLATFORM_GROUP,
  }));
const platformMember = (role) =>
  role === ROLES.SUPER_ADMIN
    ? [f.ALICE, { group: f.PLATFORM_GROUP }]
    : [PLATFORM_MEMBERS.find((user) => user.role === role)._id, {}];
const CLIENT_MEMBERS = {
  [ROLES.SUPER_ADMIN]: [f.ALICE, { group: f.CLIENT_GROUP }],
  [ROLES.GROUP_ADMIN]: [f.ERIN, {}],
  [ROLES.GROUP_ADMIN_TECH]: [f.TESS, {}],
  [ROLES.REGULAR_USER]: [f.FRANK, {}],
  [ROLES.WRITER]: [f.WREN, {}],
  [ROLES.REVIEWER]: [f.REX, {}],
};

describe('audience', () => {
  beforeEach(() =>
    harness.seed({
      ...f.SEED,
      users: [...f.USERS, ...PLATFORM_MEMBERS],
      expertises: [...f.EXPERTISES, PROVING],
      skills: [...f.SKILLS, PROVING_SKILL, CONSUMING_TASK],
    })
  );
  afterEach(() => harness.disconnect());

  const expertiseUris = async (client) =>
    (await client.listResources()).resources.map((r) => r.uri);
  const promptNames = async (client) =>
    (await client.listPrompts()).prompts.map((p) => p.name);
  const found = async (client) =>
    harness.answerOf(
      await client.callTool({
        name: 'find_applicable_expertises',
        arguments: { scope: ['subject'], categories: ['design'] },
      })
    );
  const foundIds = async (client) =>
    (await found(client)).expertises.map((e) => e.expertiseId);
  const scopesInUse = async (client) => (await found(client)).scopesInUse;
  const taskSkillText = async (client) =>
    (await client.readResource({ uri: 'lepatron://skills/qc.spacing-review' }))
      .contents[0].text;

  describe('for a client company', () => {
    it.each(Object.values(ROLES))(
      'keeps from its %s what is meant for the platform company',
      async (role) => {
        const client = await harness.connectAs(...CLIENT_MEMBERS[role]);

        expect(await expertiseUris(client)).not.toContain(uriOf(DRAFT_SHEET));
        await expect(
          client.readResource({ uri: uriOf(DRAFT_SHEET) })
        ).rejects.toThrow(/not found/i);
        expect(await foundIds(client)).not.toContain(DRAFT_SHEET);
        expect(await scopesInUse(client)).not.toContain('spacing');
        expect(await taskSkillText(client)).toContain(
          uriOf('redaction.subject-line')
        );
        expect(await taskSkillText(client)).not.toContain(DRAFT_SHEET);
        expect(await promptNames(client)).not.toContain(PROVING_SKILL.skillId);
        await expect(
          client.getPrompt({
            name: PROVING_SKILL.skillId,
            arguments: { prompt: 'Review this email' },
          })
        ).rejects.toThrow(/not found/i);
      }
    );

    it('reads nothing that has no audience yet', async () => {
      const client = await harness.connectAs(f.FRANK);
      harness.update('expertises', f.EXPERTISES[0]._id, {
        audience: undefined,
      });
      harness.update('skills', f.SKILLS[0]._id, { audience: undefined });

      expect(await expertiseUris(client)).not.toContain(
        uriOf('redaction.subject-line')
      );
      expect(await promptNames(client)).not.toContain(
        'redaction.subject-ideas'
      );
    });
  });

  describe('for the platform company', () => {
    it.each(Object.values(ROLES))(
      'lists, reads, finds and offers to its %s what is meant for it',
      async (role) => {
        const client = await harness.connectAs(...platformMember(role));

        expect(await expertiseUris(client)).toContain(uriOf(DRAFT_SHEET));
        const { contents } = await client.readResource({
          uri: uriOf(DRAFT_SHEET),
        });
        expect(contents[0].text).toContain('A rule still being proven.');
        expect(await foundIds(client)).toContain(DRAFT_SHEET);
        expect(await scopesInUse(client)).toContain('spacing');
        expect(await taskSkillText(client)).toContain(uriOf(DRAFT_SHEET));
        expect(await promptNames(client)).toContain(PROVING_SKILL.skillId);
      }
    );
  });

  it('opens an expertise to every company once its audience is all', async () => {
    const client = await harness.connectAs(f.FRANK);

    harness.update('expertises', PROVING._id, { audience: 'all' });

    expect(await expertiseUris(client)).toContain(uriOf(DRAFT_SHEET));
  });
});
