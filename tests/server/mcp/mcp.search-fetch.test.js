/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// `search` and `fetch` in the shape ChatGPT expects for deep research and
// company knowledge (ADR 0012): results carry an id, a title and a URL, and
// `fetch` reads one back. They cover the mailings the user can reach (name,
// subject, tags, email type) and the active expertises (title, sections).

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

describe('search and fetch', () => {
  let client;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    return harness.disconnect();
  });

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

    it('finds a mailing by its subject, a tag or its email type', async () => {
      const PROMOTIONAL = '507f1f77bcf86cd799439a01';
      harness.seed({
        ...f.SEED,
        taxonomyItems: [
          {
            _id: PROMOTIONAL,
            _company: f.CLIENT_GROUP,
            type: 'emailType',
            label: 'Promotional',
          },
        ],
      });
      harness.update('mailings', f.M_APPROVED, {
        subject: 'Welcome aboard',
        tags: ['onboarding'],
        _emailType: PROMOTIONAL,
      });
      client = await harness.connectAs(f.FRANK);

      for (const query of ['aboard', 'onboarding', 'promotional']) {
        // eslint-disable-next-line no-await-in-loop
        expect(ids(await search(query))).toEqual([`mailing:${f.M_APPROVED}`]);
      }
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

    it('matches whatever the case and the accents, both ways', async () => {
      harness.update('mailings', f.M_APPROVED, {
        name: 'Événement de rentrée',
      });

      expect(ids(await search('EVENEMENT rentree'))).toEqual([
        `mailing:${f.M_APPROVED}`,
      ]);
      expect(ids(await search('Black Fridäy 2025'))).toEqual([
        `mailing:${f.M_NEWSLETTER}`,
      ]);
    });

    it('finds a mailing whose words sit in different fields', async () => {
      // "black" in the name, "prices" in the subject.
      expect(ids(await search('black prices'))).toEqual([
        `mailing:${f.M_NEWSLETTER}`,
      ]);
    });

    it('takes every character of a word as written', async () => {
      harness.update('mailings', f.M_APPROVED, { name: 'Up to 50% (c++) off' });

      expect(ids(await search('(c++)'))).toEqual([`mailing:${f.M_APPROVED}`]);
      expect(ids(await search('.*'))).toEqual([]);
    });

    it('finds nothing for a query of blanks', async () => {
      expect(await search('   ')).toEqual({ results: [] });
    });

    it('refuses a query longer than a few words could be', async () => {
      const result = await client.callTool({
        name: 'search',
        arguments: { query: 'word '.repeat(100) },
      });

      expect(result.isError).toBe(true);
    });

    // No full-text search on content in this version.
    it('does not search the content of a mailing', async () => {
      expect(ids(await search('free delivery'))).toEqual([]);
    });

    it('gives the most recently updated mailings first, 20 at most', async () => {
      const promos = Array.from({ length: 22 }, (_, i) => ({
        ...f.SEED.mailings.find((m) => m._id === f.M_APPROVED),
        _id: `507f1f77bcf86cd7994395${String(i).padStart(2, '0')}`,
        name: `Promo ${i}`,
        updatedAt: f.daysFrom(-i),
      }));
      harness.seed({ ...f.SEED, mailings: [...f.SEED.mailings, ...promos] });
      client = await harness.connectAs(f.FRANK);

      const { results } = await search('promo');

      expect(results.map((result) => result.title)).toEqual(
        promos.slice(0, 20).map((promo) => promo.name)
      );
    });

    // A search reads a page of names, never the listing's count nor what the
    // listing adds to each mailing.
    it('counts nothing', async () => {
      const {
        Mailings,
        Comments,
      } = require('../../../packages/server/common/models.common.js');
      const counts = jest.spyOn(Mailings, 'countDocuments');
      const approvals = jest.spyOn(Comments, 'findApprovedMailingIds');

      expect(ids(await search('black friday'))).toEqual(
        [`mailing:${f.M_ARCHIVED}`, `mailing:${f.M_NEWSLETTER}`].sort()
      );
      expect(counts).not.toHaveBeenCalled();
      expect(approvals).not.toHaveBeenCalled();
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

    it('reads back a mailing without content, saying why', async () => {
      const document = await fetch(`mailing:${f.M_NO_PREVIEW}`);

      expect(document.title).toBe('Blank draft');
      expect(document.text).toContain('never saved in the editor');
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
