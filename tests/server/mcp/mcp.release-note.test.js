/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A release note and a change log at every publication (ADR 0031, amending
// ADR 0014): a minor version too is published from an assistant only with
// both, the release note at most 500 characters, and the generic sentence a
// minor version used to get by default is no release note.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const SUBJECT_LINES = 'redaction.subject-line';
const GENERIC_NOTE = 'Correction mineure sans changement de doctrine.';

// Subject lines with a minor draft, 2.2, and no major draft.
const SEED = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES
      ? {
          ...e,
          versions: [
            ...e.versions.filter((v) => v.status !== 'DRAFT'),
            {
              versionMajor: 2,
              versionMinor: 2,
              status: 'DRAFT',
              body: '## Length\n\nKeep the subject under 45 characters.',
              changelog: '',
              releaseNotes: '',
              createdAt: f.daysFrom(-2),
              updatedAt: f.daysFrom(-1),
            },
          ],
        }
      : e
  ),
};

const stored = () =>
  harness.stored('expertises').find((e) => e.expertiseId === SUBJECT_LINES);
const call = async (client, name, args) =>
  harness.answerOf(await client.callTool({ name, arguments: args }));
const asAuthor = () =>
  harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP, scopes: WRITE });
const publish = (client, args) =>
  call(client, 'publish_draft', {
    kind: 'expertise',
    id: SUBJECT_LINES,
    ...args,
  });

describe('release note required at publication', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  // Turned on by #1665 (a publication requires both texts)
  describe.skip('from an assistant', () => {
    it('refuses a minor version without a release note', async () => {
      const answer = await publish(await asAuthor(), { changelog: 'Typo' });

      expect(answer.error).toMatch(/release note/i);
      expect(stored().activeVersion).toEqual({ major: 2, minor: 1 });
    });

    it('refuses a minor version without a change log', async () => {
      const answer = await publish(await asAuthor(), {
        releaseNotes: 'Subjects get shorter.',
      });

      expect(answer.error).toMatch(/change ?log/i);
    });

    it('refuses a release note over 500 characters', async () => {
      const answer = await publish(await asAuthor(), {
        changelog: 'Typo',
        releaseNotes: 'x'.repeat(501),
      });

      expect(answer.error).toMatch(/500/);
    });

    it('refuses the generic sentence as a release note', async () => {
      const answer = await publish(await asAuthor(), {
        changelog: 'Typo',
        releaseNotes: GENERIC_NOTE,
      });

      expect(answer.error).toMatch(/release note/i);
    });

    it('publishes a minor version with both texts', async () => {
      const client = await asAuthor();
      const texts = {
        changelog: 'A reader asked for 45',
        releaseNotes: 'Subjects get shorter.',
      };
      const { confirmation } = await publish(client, texts);

      const answer = await publish(client, { ...texts, confirmation });

      expect(answer).toMatchObject({ version: '2.2', published: true });
      const version = stored().versions.find((v) => v.versionMinor === 2);
      expect(version).toMatchObject(texts);
    });

    it('starts a minor draft with no release note to publish as it is', async () => {
      harness.seed(f.SEED);
      const client = await asAuthor();

      await call(client, 'propose_expertise_change', {
        expertiseId: 'deliverability.spam-words',
        body: '## Words\n\nAvoid "free" and "win" in a subject.',
        changelog: 'Win is a spam word too',
      });

      const draft = harness
        .stored('expertises')
        .find((e) => e.expertiseId === 'deliverability.spam-words')
        .versions.find((v) => v.status === 'DRAFT');
      expect(draft).toMatchObject({
        versionMinor: 1,
        changelog: 'Win is a spam word too',
        releaseNotes: '',
      });
    });
  });
});
