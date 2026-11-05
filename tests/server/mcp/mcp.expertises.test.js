/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The expertises a connected application reads (ADR 0012): the active version
// of each active expertise, as a resource, with its version and update date,
// and the tool that finds those that apply to a piece of an email, and tells
// the scopes in use. Drafts and archives never leave LePatron.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;
const SUBJECT_LINES = uriOf('redaction.subject-line');
const SPAM_WORDS = uriOf('deliverability.spam-words');

describe('expertises', () => {
  let client;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  describe('as resources', () => {
    it('lists the active expertises, and only them', async () => {
      const { resources } = await client.listResources();

      // Other resources live beside them (the preview app of #1342).
      const expertises = resources
        .map((resource) => resource.uri)
        .filter((uri) => uri.startsWith('lepatron://expertises/'));

      expect(expertises.sort()).toEqual([SPAM_WORDS, SUBJECT_LINES]);
    });

    it('names each one and says when its active version was last updated', async () => {
      const { resources } = await client.listResources();
      const subjectLines = resources.find((r) => r.uri === SUBJECT_LINES);
      const activeVersion = f.EXPERTISES[0].versions[1];

      expect(subjectLines).toMatchObject({
        name: 'redaction.subject-line',
        title: 'Subject lines',
        mimeType: 'text/markdown',
        annotations: {
          lastModified: activeVersion.updatedAt.toISOString(),
        },
      });
    });

    it('reads the active version, never the newer draft', async () => {
      const { contents } = await client.readResource({ uri: SUBJECT_LINES });
      const [{ text, mimeType }] = contents;

      expect(mimeType).toBe('text/markdown');
      expect(text).toContain('Keep the subject under 50 characters.');
      expect(text).not.toContain('A draft nobody validated.');
      expect(text).not.toContain('Under 60 characters.');
    });

    it('states the version it reads', async () => {
      const { contents } = await client.readResource({ uri: SUBJECT_LINES });

      expect(contents[0].text).toMatch(/version 2\.1/i);
    });

    it('carries the good and the bad examples', async () => {
      const { contents } = await client.readResource({ uri: SUBJECT_LINES });

      expect(contents[0].text).toContain('Black Friday: -30% on everything');
      expect(contents[0].text).toContain('!!! HUGE SALE !!!');
    });

    it.each([
      ['a draft expertise', 'design.dark-mode'],
      ['an archived expertise', 'redaction.old-rules'],
      ['an expertise that does not exist', 'redaction.nothing'],
    ])('does not read %s', async (_case, expertiseId) => {
      await expect(
        client.readResource({ uri: uriOf(expertiseId) })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('find_applicable_expertises', () => {
    const find = async (args) =>
      harness.answerOf(
        await client.callTool({
          name: 'find_applicable_expertises',
          arguments: args,
        })
      );
    const ids = ({ expertises }) => expertises.map((e) => e.expertiseId);

    it('finds the expertises of a scope and categories, transversal ones included', async () => {
      const answer = await find({
        scope: ['subject'],
        categories: ['redaction', 'deliverability'],
        language: 'fr',
      });

      expect(ids(answer).sort()).toEqual([
        'deliverability.spam-words',
        'redaction.subject-line',
      ]);
    });

    // "Transversal" crosses scopes, never categories.
    it('keeps a transversal expertise out of the categories it is not in', async () => {
      const answer = await find({
        scope: ['subject'],
        categories: ['redaction'],
      });

      expect(ids(answer)).toEqual(['redaction.subject-line']);
    });

    it('leaves out an expertise that does not apply to the language', async () => {
      const answer = await find({
        scope: ['subject'],
        categories: ['redaction'],
        language: 'de',
      });

      expect(ids(answer)).toEqual([]);
    });

    it('points at each expertise as a resource, with its version', async () => {
      const answer = await find({
        scope: ['subject'],
        categories: ['redaction'],
      });

      expect(answer.expertises).toEqual([
        {
          expertiseId: 'redaction.subject-line',
          title: 'Subject lines',
          version: '2.1',
          uri: SUBJECT_LINES,
        },
      ]);
    });

    it('never finds a draft or an archived expertise', async () => {
      const answer = await find({
        scope: ['subject', 'image'],
        categories: ['redaction', 'design'],
      });

      expect(ids(answer)).toEqual(['redaction.subject-line']);
    });

    it('reads the scopes as the expertises store them', async () => {
      const answer = await find({
        scope: ' Subject ',
        categories: ['redaction'],
      });

      expect(ids(answer)).toEqual(['redaction.subject-line']);
    });

    // A transversal expertise applies whatever the scope, so a scope nothing
    // is written for still finds it.
    it('finds a transversal expertise whatever the scope', async () => {
      const answer = await find({
        scope: 'footer',
        categories: ['deliverability'],
      });

      expect(ids(answer)).toEqual(['deliverability.spam-words']);
    });

    it('finds what the known scopes give, a scope nothing is written for aside', async () => {
      const answer = await find({
        scope: ['subject', 'footer'],
        categories: ['redaction'],
      });

      expect(ids(answer)).toEqual(['redaction.subject-line']);
    });

    // Only a draft is written for "image": an assistant that guessed it is
    // told what it may ask for, in a note that is not an error.
    describe('its note on the scopes', () => {
      it('gives the scopes in use, not those of a draft or a transversal expertise', async () => {
        const answer = await find({ scope: 'subject', categories: ['qc'] });

        expect(answer).toMatchObject({
          scopesInUse: ['subject'],
          unmatchedScopes: [],
        });
      });

      it('names the scopes asked for that nothing is written for', async () => {
        const result = await client.callTool({
          name: 'find_applicable_expertises',
          arguments: {
            scope: ['subject', 'image'],
            categories: ['redaction', 'design'],
          },
        });

        expect(result.isError).toBeFalsy();
        expect(result.structuredContent.unmatchedScopes).toEqual(['image']);
        expect(result.content.map((part) => part.text)).toContain(
          'No expertise is written for "image". The scopes in use: "subject".'
        );
      });
    });

    it('asks for a scope and a category rather than answering everything', async () => {
      const answer = await find({ categories: ['redaction'] });

      expect(answer.error).toMatch(/scope/i);
    });

    it.each([
      ['a blank scope', { scope: '  ', categories: ['redaction'] }],
      ['no category', { scope: 'subject', categories: [] }],
      [
        'too many scopes',
        { scope: Array(11).fill('subject'), categories: ['redaction'] },
      ],
      [
        'a long email type',
        {
          scope: 'subject',
          categories: ['redaction'],
          emailType: 'x'.repeat(51),
        },
      ],
    ])('refuses %s before reading anything', async (_case, args) => {
      const answer = await find(args);

      expect(answer.error).toMatch(/Input validation error/);
    });

    // The same for every caller: tools/list reads nothing.
    it('has a fixed description that tells the answer gives the scopes in use', async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'find_applicable_expertises');

      expect(tool.description).toMatch(
        /the answer also gives the scopes in use/i
      );
      expect(tool.description).not.toMatch(/"subject"/);
    });
  });
});
