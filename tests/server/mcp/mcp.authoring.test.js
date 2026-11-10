/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Drafting skills and expertises through MCP (ADR 0014): a token with the
// skills:write scope, held by someone who may manage the platform, writes
// drafts. Publishing is a step of its own (publish_draft, ADR 0019), and a
// draft is never served to assistants.

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
  // The structured answer, and the text that carries the difference with the
  // active version, sent once.
  const call = async (client, name, args) => {
    const result = await client.callTool({ name, arguments: args });
    const answer = harness.answerOf(result);
    if (result.isError) return answer;
    return { ...answer, text: result.content.map((p) => p.text).join('\n') };
  };
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

    // Every role, as a right is tested (AGENTS.md): only the one that may
    // manage the platform writes, whatever the token says.
    it.each([
      ['a company admin', f.ERIN],
      ['a tech admin', f.TESS],
      ['a regular user', f.FRANK],
      ['a writer', f.WREN],
      ['a reviewer', f.REX],
    ])(
      'refuses %s, whatever the token says, and writes nothing',
      async (_role, userId) => {
        const client = await harness.connectAs(userId, { scopes: WRITE });

        const answers = await Promise.all([
          call(client, 'propose_expertise_change', {
            expertiseId: SUBJECT_LINES,
            body: NEW_BODY,
            changelog: 'Shorter subjects',
          }),
          call(client, 'create_task_skill', {
            skillId: 'qc.read-sending-report',
            title: 'Read a sending report',
            category: 'qc',
            procedure: '1. Read',
            changelog: 'First draft',
          }),
        ]);

        answers.forEach((answer) =>
          expect(answer.error).toMatch(/not allowed/i)
        );
        expect(harness.stored('expertises')).toEqual(f.SEED.expertises);
        expect(harness.stored('skills')).toEqual(f.SEED.skills);
      }
    );

    // A token granted before writing was kept to the platform company, or a
    // company that stopped being it: refused at the call (ADR 0019).
    it('refuses a super admin connected to a client company, whatever the token says', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
        scopes: WRITE,
      });

      const answer = await call(client, 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      expect(answer.error).toMatch(/not allowed/i);
      expect(harness.stored('expertises')).toEqual(f.SEED.expertises);
    });

    it('lets a super admin write', async () => {
      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      expect(answer.status).toBe('draft');
    });

    // Publishing (publish_draft, #1435) and opening to clients (set_audience,
    // #1434) came with ADR 0019, each in two calls.
    it('offers no tool that archives or deletes', async () => {
      const names = await toolNames(await asAuthor());

      names.forEach((name) => expect(name).not.toMatch(/archive|delete/));
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

    // Proposing rewrites the open draft; creating only adds one.
    it('marks the writing tools as not read-only, the proposals as destructive', async () => {
      const { tools } = await (await asAuthor()).listTools();

      const hints = tools
        .filter((tool) => AUTHORING_TOOLS.includes(tool.name))
        .map((tool) => ({
          tool: tool.name,
          readOnly: tool.annotations.readOnlyHint,
          destructive: tool.annotations.destructiveHint,
          output: tool.outputSchema.type,
        }));

      expect(hints).toEqual(
        expect.arrayContaining(
          AUTHORING_TOOLS.map((tool) => ({
            tool,
            readOnly: false,
            destructive: tool.startsWith('propose_'),
            output: 'object',
          }))
        )
      );
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
        status: 'draft',
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

      expect(answer.text).toContain('- Keep the subject under 50 characters.');
      expect(answer.text).toContain('+ Keep the subject under 45 characters.');
      expect(answer.text).not.toContain('One promise, no shouting.');
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
      expect(second.text).toContain('+ One at most.');
    });

    it('says when only spaces or blank lines change', async () => {
      harness.seed(WITHOUT_DRAFT);

      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: `${
          f.EXPERTISES[0].versions.find((v) => v.status === 'ACTIVE').body
        }\n\n\n`,
        changelog: 'Spacing',
      });

      expect(answer.text).toMatch(/Only spaces or blank lines differ/);
      expect(answer.text).not.toMatch(/does not differ/);
    });

    it('sends the difference once, in the text', async () => {
      harness.seed(WITHOUT_DRAFT);
      const client = await asAuthor();

      const result = await client.callTool({
        name: 'propose_expertise_change',
        arguments: {
          expertiseId: SUBJECT_LINES,
          body: NEW_BODY,
          changelog: 'Shorter subjects',
        },
      });

      const sent = JSON.stringify(result);
      const line = '+ Keep the subject under 45 characters.';
      expect(sent.indexOf(line)).toBeGreaterThan(-1);
      expect(sent.indexOf(line)).toBe(sent.lastIndexOf(line));
      expect(result.structuredContent).toEqual({
        expertiseId: SUBJECT_LINES,
        version: '2.2',
        status: 'draft',
        audience: 'all',
        addressesRetex: [],
      });
    });

    // A task skill reads its expertises in their order (ADR 0013).
    it('shows the consumed expertises put in another order', async () => {
      const SPAM_WORDS = 'deliverability.spam-words';
      harness.seed({
        ...f.SEED,
        skills: [
          {
            skillId: 'qc.review',
            title: 'Review an email',
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
                procedure: '1. Review',
                consumedExpertiseIds: [SUBJECT_LINES, SPAM_WORDS],
              },
            ],
          },
        ],
      });

      const answer = await call(await asAuthor(), 'propose_skill_change', {
        skillId: 'qc.review',
        consumedExpertiseIds: [SPAM_WORDS, SUBJECT_LINES],
        changelog: 'Spam words first',
      });

      expect(answer.text).toContain('@@ consumedExpertiseIds');
      expect(answer.text).toMatch(/^- redaction\.subject-line$/m);
      expect(answer.text).toMatch(/^\+ redaction\.subject-line$/m);
    });

    it('bounds the difference of a long change', async () => {
      harness.seed(WITHOUT_DRAFT);
      const body = Array.from({ length: 400 }, (_, i) => `Rule ${i}`).join(
        '\n'
      );

      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body,
        changelog: 'Many rules',
      });

      expect(answer.text).toMatch(/… \d+ more lines$/);
      expect(answer.text.split('\n').length).toBeLessThan(210);
    });

    // What a person or an earlier proposal wrote of the draft stays.
    it('adds its changelog after the one of the draft it writes into', async () => {
      harness.seed(
        withVersions([{ ...draft(2, 2), changelog: 'By a person' }])
      );
      const client = await asAuthor();
      const propose = (changelog) =>
        call(client, 'propose_expertise_change', {
          expertiseId: SUBJECT_LINES,
          body: NEW_BODY,
          changelog,
        });

      await propose('Shorter subjects');
      await propose('No shouting');

      const { versions } = harness
        .stored('expertises')
        .find((expertise) => expertise.expertiseId === SUBJECT_LINES);
      const open = versions.find((v) => v.status === 'DRAFT');
      expect(open.changelog).toBe('By a person\nShorter subjects\nNo shouting');
    });

    it('writes its changelog alone into the draft it starts', async () => {
      harness.seed(WITHOUT_DRAFT);

      await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      const { versions } = harness
        .stored('expertises')
        .find((expertise) => expertise.expertiseId === SUBJECT_LINES);
      const open = versions.find((v) => v.status === 'DRAFT');
      expect(open.changelog).toBe('Shorter subjects');
    });

    // An assistant may send changes at once (a race first reproduced in
    // review): one draft is opened, and no change is written over another
    // without saying so. A change that finds the draft changed since it read
    // it is refused, to be sent again; nothing it said is lost silently.
    describe('changes proposed at once', () => {
      const proposeAll = async (seed) => {
        harness.seed(seed);
        const client = await asAuthor();
        const proposals = [
          { body: '## A\n\nfirst', changelog: 'First change' },
          { body: '## B\n\nsecond', changelog: 'Second change' },
        ];
        const answers = await Promise.all(
          proposals.map((proposal) =>
            call(client, 'propose_expertise_change', {
              expertiseId: SUBJECT_LINES,
              ...proposal,
            })
          )
        );
        const { versions } = harness
          .stored('expertises')
          .find((expertise) => expertise.expertiseId === SUBJECT_LINES);
        return {
          proposals,
          answers,
          drafts: versions.filter((v) => v.status === 'DRAFT'),
        };
      };

      it.each([
        ['when they start the draft', WITHOUT_DRAFT],
        ['into an open draft', withVersions([draft(2, 2)])],
      ])('keeps every change it says it wrote, %s', async (_case, seed) => {
        const { proposals, answers, drafts } = await proposeAll(seed);

        expect(drafts).toHaveLength(1);
        const [open] = drafts;
        expect(open.changelog).not.toContain('Correction mineure');
        answers.forEach((answer, i) => {
          if (answer.error) {
            expect(answer.error).toMatch(/changed since it was read/);
            expect(open.changelog).not.toContain(proposals[i].changelog);
          } else {
            expect(open.changelog).toContain(proposals[i].changelog);
          }
        });
        const written = answers.filter((answer) => !answer.error);
        expect(written.length).toBeGreaterThan(0);
      });

      // Both read the same open draft before either writes.
      it('refuses the second of two changes written over the same reading', async () => {
        const { answers, drafts } = await proposeAll(
          withVersions([draft(2, 2)])
        );

        expect(answers.filter((answer) => answer.error)).toHaveLength(1);
        expect(drafts[0].body).toBe('## A\n\nfirst');
      });
    });

    // Archived between the reading of its draft and the writing of the
    // proposal, it takes no more drafts.
    it('writes nothing into an expertise archived since its draft was read', async () => {
      harness.seed(withVersions([draft(2, 2)]));
      const service = require('../../../packages/server/ai-skill/services/expertise.service.js');
      const { doc, version } = await service.openOrStartDraft(SUBJECT_LINES);
      await service.archiveExpertise(SUBJECT_LINES);

      await expect(
        service.writeDraftIfUnchanged(doc, version, { body: NEW_BODY }, null)
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/archived/),
      });
      const stored = harness
        .stored('expertises')
        .find((expertise) => expertise.expertiseId === SUBJECT_LINES);
      expect(stored.versions.find((v) => v.status === 'DRAFT').body).not.toBe(
        NEW_BODY
      );
    });

    it('counts the default changelog of a minor version as empty', async () => {
      harness.seed(
        withVersions([{ ...draft(2, 2), changelog: 'Correction mineure' }])
      );

      await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      const { versions } = harness
        .stored('expertises')
        .find((expertise) => expertise.expertiseId === SUBJECT_LINES);
      expect(versions.find((v) => v.status === 'DRAFT').changelog).toBe(
        'Shorter subjects'
      );
    });

    it('refuses a proposal that would make the changelog of a draft too long', async () => {
      harness.seed(
        withVersions([{ ...draft(2, 2), changelog: 'x'.repeat(9990) }])
      );

      const answer = await call(await asAuthor(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: NEW_BODY,
        changelog: 'Shorter subjects',
      });

      expect(answer.error).toMatch(
        /changelog of this draft would exceed 10000/
      );
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

      expect(created).toMatchObject({ version: '1.0', status: 'draft' });
      expect(changed.version).toBe('1.0');
      expect(changed.text).toContain('+ 2. Never guess.');
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
        status: 'draft',
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

      expect(answer).toMatchObject({ version: '1.0', status: 'draft' });
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
      expect(again).toMatchObject({ version: '1.0', status: 'draft' });
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
