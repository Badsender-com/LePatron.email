/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Drafting skills and expertises through MCP (ADR 0014): a token with the
// skills:write scope, held by someone who may manage the platform, writes
// drafts and nothing else. Publishing stays in the back office, and a draft is
// never served to assistants.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const AUTHORING_TOOLS = [
  'create_expertise',
  'create_task_skill',
  'propose_expertise_change',
  'propose_skill_change',
];
const SUBJECT_LINES = 'redaction.subject-line';
const NEW_BODY =
  '## Length\n\nKeep the subject under 45 characters.\n\n## Tone\n\nOne promise, no shouting.';

// The fixtures, the open draft of the subject lines expertise taken away.
const WITHOUT_DRAFT = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES
      ? { ...e, versions: e.versions.filter((v) => v.status !== 'DRAFT') }
      : e
  ),
};

// The subject lines expertise with only some of its versions, and others.
const withVersions = (versions, extra = {}) => ({
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES
      ? {
          ...e,
          ...extra,
          versions: [
            ...e.versions.filter((v) => v.status !== 'DRAFT'),
            ...versions,
          ],
        }
      : e
  ),
});
const draft = (versionMajor, versionMinor) => ({
  versionMajor,
  versionMinor,
  status: 'DRAFT',
  body: '## Length\n\nAn old draft, left behind.',
  examplesGood: [],
  examplesBad: [],
  updatedAt: f.daysFrom(-40),
});

// Turned on by #1349 (drafting skills and expertises from an assistant)
describe('authoring', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  const asAuthor = () =>
    harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP, scopes: WRITE });
  const call = async (client, name, args) =>
    harness.answerOf(await client.callTool({ name, arguments: args }));
  const toolNames = async (client) =>
    (await client.listTools()).tools.map((tool) => tool.name);

  describe('who may write', () => {
    it('lists no writing tool to a token without the skills:write scope', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.PLATFORM_GROUP,
      });

      const names = await toolNames(client);
      AUTHORING_TOOLS.forEach((name) => expect(names).not.toContain(name));
    });

    it('lists them to a token with the scope', async () => {
      const client = await asAuthor();

      expect(await toolNames(client)).toEqual(
        expect.arrayContaining(AUTHORING_TOOLS)
      );
    });

    it('refuses a user who may not manage the platform, whatever the token says', async () => {
      const client = await harness.connectAs(f.ERIN, { scopes: WRITE });

      const answer = await call(client, 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      expect(answer.error).toMatch(/not allowed/i);
    });

    it('offers no tool that publishes, archives, deletes or opens to clients', async () => {
      const names = await toolNames(await asAuthor());

      names.forEach((name) =>
        expect(name).not.toMatch(/activate|publish|archive|delete|audience/)
      );
    });

    it('tells how the body of an expertise is cut into sections', async () => {
      const { tools } = await (await asAuthor()).listTools();

      tools
        .filter((tool) => AUTHORING_TOOLS.includes(tool.name))
        .filter((tool) => /expertise/.test(tool.name))
        .forEach((tool) => {
          expect(tool.description).toContain('## [section-id] Title');
        });
    });

    it('marks the writing tools as not read-only and not destructive', async () => {
      const { tools } = await (await asAuthor()).listTools();

      tools
        .filter((tool) => AUTHORING_TOOLS.includes(tool.name))
        .forEach((tool) => {
          expect(tool.annotations).toMatchObject({
            readOnlyHint: false,
            destructiveHint: false,
          });
          expect(tool.outputSchema.type).toBe('object');
        });
    });
  });

  describe('proposing a change', () => {
    it('starts a minor draft from the active version, and serves the active one still', async () => {
      harness.seed(WITHOUT_DRAFT);
      const client = await asAuthor();

      const answer = await call(client, 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      expect(answer).toMatchObject({
        expertiseId: SUBJECT_LINES,
        version: '2.2',
        status: 'DRAFT',
      });
      const { contents } = await client.readResource({
        uri: `lepatron://expertises/${SUBJECT_LINES}`,
      });
      expect(contents[0].text).toContain(
        'Keep the subject under 50 characters.'
      );
    });

    it('gives the difference with the active version', async () => {
      harness.seed(WITHOUT_DRAFT);
      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      expect(answer.diff).toContain('- Keep the subject under 50 characters.');
      expect(answer.diff).toContain('+ Keep the subject under 45 characters.');
      expect(answer.diff).not.toContain('One promise, no shouting.');
    });

    // The fixture's expertise already has a 3.0 draft: a change goes there,
    // rather than opening a second one.
    it('updates the open draft rather than opening another', async () => {
      const client = await asAuthor();
      const args = { expertiseId: SUBJECT_LINES, changelog: 'Shorter' };

      const first = await call(client, 'propose_expertise_change', {
        ...args,
        body: NEW_BODY,
      });
      const second = await call(client, 'propose_expertise_change', {
        ...args,
        body: `${NEW_BODY}\n\n## Emojis\n\nOne at most.`,
      });

      expect(first.version).toBe('3.0');
      expect(second.version).toBe('3.0');
      expect(second.diff).toContain('+ One at most.');
    });

    it('starts a major draft when asked', async () => {
      harness.seed(WITHOUT_DRAFT);

      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'A new doctrine',
        major: true,
      });

      expect(answer.version).toBe('3.0');
    });

    // Publishing 2.1 archived only the active 2.0, never the 1.3 left open.
    it('never writes into a draft older than the active version', async () => {
      harness.seed(withVersions([draft(1, 3)]));

      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter',
      });

      expect(answer.version).toBe('2.2');
    });

    it('refuses a major change while a minor draft is open', async () => {
      harness.seed(withVersions([draft(2, 2)]));

      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'A new doctrine',
        major: true,
      });

      expect(answer.error).toMatch(/minor draft 2\.2 is open/);
    });

    it('starts no draft on an archived expertise', async () => {
      harness.seed(withVersions([], { status: 'ARCHIVED' }));

      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter',
      });

      expect(answer.error).toMatch(/archived/);
    });

    it('requires a changelog', async () => {
      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
      });

      expect(answer.error).toMatch(/changelog/i);
    });

    it('changes a task skill’s procedure and the expertises it consumes', async () => {
      const client = await asAuthor();
      const created = await call(client, 'create_task_skill', {
        skillId: 'qc.read-sending-report',
        title: 'Read a sending report',
        category: 'qc',
        procedure: '## Steps\n\n1. Describe the report.',
        consumedExpertiseIds: [SUBJECT_LINES],
        changelog: 'First draft',
      });

      const changed = await call(client, 'propose_skill_change', {
        skillId: 'qc.read-sending-report',
        procedure: '## Steps\n\n1. Describe the report.\n2. Never guess.',
        changelog: 'One more step',
      });

      expect(created).toMatchObject({ version: '1.0', status: 'DRAFT' });
      expect(changed.version).toBe('1.0');
      expect(changed.diff).toContain('+ 2. Never guess.');
    });

    // The assistant fixes what it is told: the code alone does not say which.
    it('says which expertises a refusal is about', async () => {
      const client = await asAuthor();
      await call(client, 'create_task_skill', {
        skillId: 'qc.read-sending-report',
        title: 'Read a sending report',
        category: 'qc',
        procedure: '## Steps\n\n1. Describe the report.',
        changelog: 'First draft',
      });

      const answer = await call(client, 'propose_skill_change', {
        skillId: 'qc.read-sending-report',
        consumedExpertiseIds: ['design.never-written'],
        changelog: 'Reads the contrast',
      });

      expect(answer.error).toMatch(/SKILL_CONSUMED_EXPERTISES_NOT_FOUND/);
      expect(answer.error).toContain('design.never-written');
    });
  });

  describe('creating', () => {
    it('creates an expertise as a draft, for the platform group, not served', async () => {
      const client = await asAuthor();

      const answer = await call(client, 'create_expertise', {
        expertiseId: 'design.button-contrast',
        title: 'Button contrast',
        category: 'design',
        scope: ['cta'],
        body: '## Contrast\n\nAt least 4.5:1.',
        changelog: 'First draft',
      });

      expect(answer).toMatchObject({
        expertiseId: 'design.button-contrast',
        version: '1.0',
        status: 'DRAFT',
        audience: 'platform',
      });
      const { resources } = await client.listResources();
      expect(resources.map((r) => r.uri)).not.toContain(
        'lepatron://expertises/design.button-contrast'
      );
    });

    it('refuses an identifier that already exists', async () => {
      const answer = await call(await asAuthor(), 'create_expertise', {
        expertiseId: SUBJECT_LINES,
        title: 'Again',
        category: 'redaction',
        body: '## Again',
        changelog: 'First draft',
      });

      expect(answer.error).toMatch(/already exists/i);
    });

    const TASK_SKILL = {
      skillId: 'qc.read-sending-report',
      title: 'Read a sending report',
      category: 'qc',
      procedure: '## Steps\n\n1. Describe the report.',
      changelog: 'First draft',
    };
    const storedSkill = () =>
      harness
        .stored('skills')
        .find((skill) => skill.skillId === TASK_SKILL.skillId);

    it('creates a task skill whole, its first version a task', async () => {
      const answer = await call(await asAuthor(), 'create_task_skill', {
        ...TASK_SKILL,
        consumedExpertiseIds: [SUBJECT_LINES],
      });

      expect(answer).toMatchObject({ version: '1.0', status: 'DRAFT' });
      expect(storedSkill().versions).toEqual([
        expect.objectContaining({
          versionMajor: 1,
          versionMinor: 0,
          nature: 'task',
          procedure: TASK_SKILL.procedure,
          consumedExpertiseIds: [SUBJECT_LINES],
          changelog: 'First draft',
        }),
      ]);
    });

    // Nothing half made: the assistant can send the same creation again,
    // fixed, and get the task skill it asked for.
    it('leaves nothing behind when an expertise it consumes does not exist', async () => {
      const client = await asAuthor();

      const refused = await call(client, 'create_task_skill', {
        ...TASK_SKILL,
        consumedExpertiseIds: ['design.never-written'],
      });
      const again = await call(client, 'create_task_skill', TASK_SKILL);

      expect(refused.error).toContain('design.never-written');
      expect(again).toMatchObject({ version: '1.0', status: 'DRAFT' });
      expect(storedSkill().versions).toHaveLength(1);
      expect(storedSkill().versions[0].nature).toBe('task');
    });

    // Only an answer that it does not exist lets the creation go on.
    it('creates nothing when it cannot tell whether the identifier exists', async () => {
      const models = require('../../../packages/server/common/models.common.js');
      const findOne = jest
        .spyOn(models.Expertises, 'findOne')
        .mockImplementationOnce(() => {
          throw new Error('The database did not answer');
        });

      const answer = await call(await asAuthor(), 'create_expertise', {
        expertiseId: 'design.button-contrast',
        title: 'Button contrast',
        category: 'design',
        body: '## Contrast',
        changelog: 'First draft',
      });
      findOne.mockRestore();

      expect(answer.error).toBeDefined();
      expect(
        harness.stored('expertises').map((expertise) => expertise.expertiseId)
      ).not.toContain('design.button-contrast');
    });
  });
});
