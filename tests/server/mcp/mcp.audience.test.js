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

const DRAFT_SHEET = 'design.draft-guidelines';
const PROVING = {
  _id: '507f1f77bcf86cd799439805',
  expertiseId: DRAFT_SHEET,
  title: 'Draft guidelines',
  category: 'design',
  scope: ['subject'],
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
  nature: 'task',
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
      procedure: 'Check the spacing.',
      consumedExpertiseIds: ['redaction.subject-line', DRAFT_SHEET],
    },
  ],
};
const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;

describe('audience', () => {
  beforeEach(() =>
    harness.seed({
      ...f.SEED,
      expertises: [...f.EXPERTISES, PROVING],
      skills: [...f.SKILLS, PROVING_SKILL, CONSUMING_TASK],
    })
  );
  afterEach(() => harness.disconnect());

  const expertiseUris = async (client) =>
    (await client.listResources()).resources.map((r) => r.uri);
  const promptNames = async (client) =>
    (await client.listPrompts()).prompts.map((p) => p.name);

  describe('for a client group', () => {
    let client;
    beforeEach(async () => {
      client = await harness.connectAs(f.FRANK);
    });

    it('lists no expertise meant for the platform group', async () => {
      expect(await expertiseUris(client)).not.toContain(uriOf(DRAFT_SHEET));
    });

    it('reads no expertise meant for the platform group', async () => {
      await expect(
        client.readResource({ uri: uriOf(DRAFT_SHEET) })
      ).rejects.toThrow(/not found/i);
    });

    it('finds no expertise meant for the platform group', async () => {
      const answer = harness.answerOf(
        await client.callTool({
          name: 'find_applicable_expertises',
          arguments: { scope: ['subject'], categories: ['design'] },
        })
      );

      expect(answer.expertises.map((e) => e.expertiseId)).not.toContain(
        DRAFT_SHEET
      );
    });

    it('names no expertise meant for the platform group in a skill it reads', async () => {
      const { contents } = await client.readResource({
        uri: 'lepatron://skills/qc.spacing-review',
      });

      expect(contents[0].text).toContain(uriOf('redaction.subject-line'));
      expect(contents[0].text).not.toContain(DRAFT_SHEET);
    });

    it('offers no skill meant for the platform group', async () => {
      expect(await promptNames(client)).not.toContain(PROVING_SKILL.skillId);
      await expect(
        client.getPrompt({
          name: PROVING_SKILL.skillId,
          arguments: { prompt: 'Review this email' },
        })
      ).rejects.toThrow(/not found/i);
    });

    it('reads nothing that has no audience yet', async () => {
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

  describe('for the platform group', () => {
    it('lists, reads and offers what is meant for it', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.PLATFORM_GROUP,
      });

      expect(await expertiseUris(client)).toContain(uriOf(DRAFT_SHEET));
      const { contents } = await client.readResource({
        uri: uriOf(DRAFT_SHEET),
      });
      expect(contents[0].text).toContain('A rule still being proven.');
      expect(await promptNames(client)).toContain(PROVING_SKILL.skillId);
    });

    // A super admin working in a client group sees what that group sees.
    it('keeps it from a super admin bound to a client group', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
      });

      expect(await expertiseUris(client)).not.toContain(uriOf(DRAFT_SHEET));
    });
  });

  it('opens an expertise to every company once its audience is all', async () => {
    const client = await harness.connectAs(f.FRANK);

    harness.update('expertises', PROVING._id, { audience: 'all' });

    expect(await expertiseUris(client)).toContain(uriOf(DRAFT_SHEET));
  });
});
