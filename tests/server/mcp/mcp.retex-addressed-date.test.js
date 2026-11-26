/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// An addressed retex says when it was addressed (ADR 0031): the day the
// version that took it into account was published, so the delay between a
// lesson and its change is read.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const SUBJECT_LINES = 'redaction.subject-line'; // 2.1 active, 3.0 draft
const ANCHORED_BODY =
  '## [length] Length\n\nKeep the subject under 50 characters.\n\n## [tone] Tone\n\nOne promise, no shouting.';
const SEED = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES
      ? {
          ...e,
          versions: e.versions.map((v) =>
            v.status === 'ACTIVE' ? { ...v, body: ANCHORED_BODY } : v
          ),
        }
      : e
  ),
};

const call = async (client, name, args) =>
  harness.answerOf(await client.callTool({ name, arguments: args }));
const asConsultant = () =>
  harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP, scopes: WRITE });

describe('addressed retex date', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  // Turned on by #1670 (an addressed retex says when)
  describe('when a publication addresses a retex', () => {
    it('gives the date it was addressed, in UTC, and none to an open one', async () => {
      const client = await asConsultant();
      const { retexId } = await call(client, 'report_retex', {
        kind: 'divergence',
        about: { kind: 'expertise', id: SUBJECT_LINES },
        section: 'length',
        recommended: 'A subject under 50 characters',
        decided: 'A 62-character subject',
        why: 'In B2B, the longer subject named the product',
      });
      const open = await call(client, 'list_retex', {});
      expect(open.items[0]).not.toHaveProperty('addressedAt');

      await call(client, 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: '## [length] Length\n\nUnder 50 characters, unless B2B.',
        changelog: 'B2B subjects may name the product',
        addressesRetex: [retexId],
      });
      const draft = {
        kind: 'expertise',
        id: SUBJECT_LINES,
        changelog: 'B2B subjects may name the product',
        releaseNotes: 'A B2B subject may name the product.',
      };
      const { confirmation } = await call(client, 'publish_draft', draft);
      const before = Date.now();
      await call(client, 'publish_draft', { ...draft, confirmation });

      const { items } = await call(client, 'list_retex', {
        status: 'addressed',
      });
      expect(items[0].addressedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(Date.parse(items[0].addressedAt)).toBeGreaterThanOrEqual(
        before - 1000
      );
    });
  });
});
