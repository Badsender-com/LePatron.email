'use strict';

// What the import modal of the skills export shows (ADR 0018): which items
// are checked at first, which can be checked at all, how many will be
// imported, and the words for each state, reason and outcome, in both
// languages. The project has no @vue/test-utils: the modal's rules live in this
// helper, and the modal reads them.

const fs = require('fs');
const path = require('path');

const ITEMS = [
  {
    kind: 'expertise',
    id: 'redaction.subject-line',
    version: '2.1',
    state: 'new',
  },
  {
    kind: 'expertise',
    id: 'deliverability.spam-words',
    version: '1.0',
    state: 'update',
  },
  {
    kind: 'expertise',
    id: 'design.dark-mode',
    version: '1.0',
    state: 'up_to_date',
  },
  {
    kind: 'skill',
    id: 'redaction.subject-ideas',
    version: '1.2',
    state: 'blocked',
    reason: 'missing_schema',
  },
  {
    kind: 'skill',
    id: 'redaction.write-subject',
    version: '1.0',
    state: 'new',
    warnings: [{ code: 'missing_expertises', expertiseIds: ['a.b'] }],
  },
];

describe('the preview of an import', () => {
  let helper;
  beforeAll(() => {
    // Required here: the helper does not exist until #1410 ships it.
    helper = require('~/helpers/skills-import.js');
  });

  it('checks the new items and the updates at first', () => {
    expect(helper.defaultSelection(ITEMS)).toEqual([
      'expertise:redaction.subject-line',
      'expertise:deliverability.spam-words',
      'skill:redaction.write-subject',
    ]);
  });

  it('lets no blocked or up to date item be checked', () => {
    expect(ITEMS.filter(helper.isSelectable).map((item) => item.id)).toEqual([
      'redaction.subject-line',
      'deliverability.spam-words',
      'redaction.write-subject',
    ]);
  });

  it('turns a selection into what the import route takes', () => {
    expect(
      helper.importPayload([
        'expertise:redaction.subject-line',
        'skill:redaction.write-subject',
      ])
    ).toEqual({
      expertiseIds: ['redaction.subject-line'],
      skillIds: ['redaction.write-subject'],
    });
  });

  it.each(['en', 'fr'])(
    'has the words of every state and reason in %s',
    (l) => {
      const locale = fs.readFileSync(
        path.join(__dirname, `../../../packages/ui/helpers/locales/${l}.js`),
        'utf8'
      );
      // Within the import's own words, not anywhere in the file.
      const start = locale.indexOf('skillsImport: {');
      expect(start).toBeGreaterThan(-1);
      // The block ends where the next top-level key starts.
      const section = locale.slice(start, locale.indexOf('\n  },', start));
      [
        'new',
        'update',
        'up_to_date',
        'blocked',
        'diverged',
        'target_newer',
        'draft_open',
        'archived',
        'missing_schema',
        'missing_expertises',
      ].forEach((key) => expect(section).toMatch(new RegExp(`\\b${key}:`)));
    }
  );
});

describe('the report of an import', () => {
  let helper;
  beforeAll(() => {
    helper = require('~/helpers/skills-import.js');
  });

  it('counts each outcome', () => {
    expect(
      helper.reportCounts({
        created: [{}, {}],
        updated: [{}],
        skipped: [],
        failed: [{}],
      })
    ).toEqual({ created: 2, updated: 1, skipped: 0, failed: 1 });
  });

  it('links each draft to publish to its page in the back office', () => {
    expect(
      helper.draftLinks({
        created: [{ kind: 'expertise', id: 'a.b', version: '1.0' }],
        updated: [{ kind: 'skill', id: 'c.d', version: '2.1' }],
      })
    ).toEqual([
      { id: 'a.b', version: '1.0', to: '/ai-expertise/a.b' },
      { id: 'c.d', version: '2.1', to: '/ai-skills/c.d' },
    ]);
  });
});
