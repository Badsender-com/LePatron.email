'use strict';

// The audience of a skill or an expertise (ADR 0013): the platform group, or
// every subscribed group. A new one starts with the platform group, where the
// Badsender team proves it before it is opened; a client never reads it until
// then. The ones that exist count as opened to every subscribed group.

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
const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;

// Turned on by #1344 (the audience of skills and expertises)
describe.skip('audience', () => {
  beforeEach(() =>
    harness.seed({
      ...f.SEED,
      expertises: [...f.EXPERTISES, PROVING],
      skills: [...f.SKILLS, PROVING_SKILL],
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

    it('offers no skill meant for the platform group', async () => {
      expect(await promptNames(client)).not.toContain(PROVING_SKILL.skillId);
      await expect(
        client.getPrompt({
          name: PROVING_SKILL.skillId,
          arguments: { prompt: 'Review this email' },
        })
      ).rejects.toThrow(/not found/i);
    });

    it('reads what exists from before audiences, as opened to every group', async () => {
      expect(await expertiseUris(client)).toContain(
        uriOf('redaction.subject-line')
      );
      expect(await promptNames(client)).toContain('redaction.subject-ideas');
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

  it('opens an expertise to every group once its audience changes', async () => {
    const client = await harness.connectAs(f.FRANK);

    harness.update('expertises', PROVING._id, { audience: 'subscribers' });

    expect(await expertiseUris(client)).toContain(uriOf(DRAFT_SHEET));
  });
});
