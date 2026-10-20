'use strict';

// `search` and `fetch` in the shape ChatGPT expects for deep research and
// company knowledge (ADR 0008): results carry an id, a title and a URL, and
// `fetch` reads one back. They cover the mailings the user can reach (name,
// subject, tags, email type) and the active expertises (title, sections).

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

// Turned on by #1305 (search and fetch for ChatGPT)
describe.skip('search and fetch', () => {
  let client;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  const search = async (query) =>
    harness.answerOf(
      await client.callTool({ name: 'search', arguments: { query } })
    );
  const fetch = async (id) =>
    harness.answerOf(
      await client.callTool({ name: 'fetch', arguments: { id } })
    );
  const ids = ({ results }) => results.map((result) => result.id).sort();

  describe('search', () => {
    it('finds the mailings of the user by name, subject or tag', async () => {
      expect(ids(await search('black friday'))).toEqual(
        [`mailing:${f.M_ARCHIVED}`, `mailing:${f.M_NEWSLETTER}`].sort()
      );
    });

    it('gives each result an id, a title and a link to the app', async () => {
      const { results } = await search('Black Friday 2025');

      expect(results).toEqual([
        {
          id: `mailing:${f.M_NEWSLETTER}`,
          title: 'Black Friday 2025',
          url: expect.stringMatching(new RegExp(`/editor/${f.M_NEWSLETTER}$`)),
        },
      ]);
    });

    it('finds an expertise by its title or a section', async () => {
      expect(ids(await search('subject lines'))).toContain(
        'expertise:redaction.subject-line'
      );
      expect(ids(await search('tone'))).toContain(
        'expertise:redaction.subject-line'
      );
    });

    it('never finds a mailing of a workspace the user cannot reach', async () => {
      expect(ids(await search('spring'))).toEqual([]);
      expect(ids(await search('their newsletter'))).toEqual([]);
    });

    it('never finds a draft or an archived expertise', async () => {
      expect(ids(await search('dark mode'))).toEqual([]);
      expect(ids(await search('old rules'))).toEqual([]);
    });

    // No full-text search on content in this version.
    it('does not search the content of a mailing', async () => {
      expect(ids(await search('free delivery'))).toEqual([]);
    });
  });

  describe('fetch', () => {
    it('reads back a mailing found by search, as text', async () => {
      const document = await fetch(`mailing:${f.M_NEWSLETTER}`);

      expect(document).toMatchObject({
        id: `mailing:${f.M_NEWSLETTER}`,
        title: 'Black Friday 2025',
        url: expect.stringMatching(new RegExp(`/editor/${f.M_NEWSLETTER}$`)),
        metadata: expect.objectContaining({ status: 'pushed-to-esp' }),
      });
      expect(document.text).toContain('Black Friday is coming');
    });

    it('reads back the active version of an expertise', async () => {
      const document = await fetch('expertise:redaction.subject-line');

      expect(document.title).toBe('Subject lines');
      expect(document.text).toContain('Keep the subject under 50 characters.');
      expect(document.metadata).toMatchObject({ version: '2.1' });
    });

    it.each([
      ['a mailing the user cannot reach', `mailing:${f.M_PROMO}`],
      ['a draft expertise', 'expertise:design.dark-mode'],
      ['an id of no known kind', `template:${f.M_NEWSLETTER}`],
    ])('does not read %s', async (_case, id) => {
      expect((await fetch(id)).error).toMatch(/not found/i);
    });
  });
});
