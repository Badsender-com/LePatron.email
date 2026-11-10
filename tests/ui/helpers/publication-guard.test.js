'use strict';

// The publication guard in the back office (ADR 0019, #1430): when the server
// asks for it, how each replayed case went, and its words in both languages.

const fs = require('fs');
const path = require('path');

const {
  guardRequired,
  sideOutcome,
  caseOutcome,
  failedCount,
  outputText,
  notReplayedOf,
  expectedText,
} = require('../../../packages/ui/helpers/publication-guard');
const {
  aiVersionAction,
} = require('../../../packages/ui/helpers/ai-skill-routes');

const asked = (data, status = 409) => ({ response: { status, data } });
const SUBJECTS = { featureType: 'subject_generation', description: 'Subjects' };
const OK = {
  after: { output: { text: 'Winter sale' } },
  contract: { before: true, after: true },
};
const BROKEN = {
  after: { error: 'OUTPUT_CONTRACT' },
  contract: { before: true, after: false },
};
const DOWN = {
  after: { error: 'CALL_FAILED' },
  contract: { before: true, after: null },
};

describe('the publication guard', () => {
  it('is asked for by the server, with what it would replay', () => {
    expect(
      guardRequired(
        asked({
          message: 'SKILL_PUBLICATION_GUARD_REQUIRED',
          usedBy: [SUBJECTS],
          calls: 4,
          maxCalls: 60,
          notReplayed: 2,
          missing: ['redaction.preheader-ideas'],
        })
      )
    ).toEqual({
      usedBy: [SUBJECTS],
      calls: 4,
      maxCalls: 60,
      notReplayed: 2,
      missing: ['redaction.preheader-ideas'],
    });
  });

  it('shows what a good output should hold, as text or as JSON', () => {
    expect(expectedText({ expectedOutput: 'Under 40 characters' })).toBe(
      'Under 40 characters'
    );
    expect(expectedText({ expectedOutput: { subjects: ['a'] } })).toBe(
      '{\n  "subjects": [\n    "a"\n  ]\n}'
    );
    expect(expectedText({})).toBe('');
    expect(expectedText(null)).toBe('');
  });

  it('counts the cases left out past the cap of calls', () => {
    expect(notReplayedOf({ notReplayed: 2 })).toBe(2);
    expect(notReplayedOf({})).toBe(0);
    expect(notReplayedOf(null)).toBe(0);
  });

  it('is not asked for by any other error', () => {
    expect(guardRequired(asked({ message: 'Other' }))).toBeNull();
    expect(
      guardRequired(asked({ message: 'SKILL_PUBLICATION_GUARD_REQUIRED' }, 400))
    ).toBeNull();
    expect(guardRequired(new Error('network'))).toBeNull();
  });

  it('says how each side of a case went', () => {
    expect(sideOutcome(null, null)).toBe('none');
    expect(sideOutcome({ output: { text: 'x' } }, true)).toBe('ok');
    expect(sideOutcome({ error: 'OUTPUT_CONTRACT' }, false)).toBe('contract');
    expect(sideOutcome({ error: 'CALL_FAILED' }, null)).toBe('error');
    expect(caseOutcome(BROKEN)).toBe('contract');
  });

  it('counts the cases whose new output fails, without stopping on them', () => {
    expect(failedCount({ cases: [OK, BROKEN, DOWN] })).toBe(2);
    expect(failedCount({ cases: [] })).toBe(0);
    expect(failedCount(null)).toBe(0);
  });

  it('shows a text output as text, any other as JSON', () => {
    expect(outputText({ output: { text: 'Winter sale' } })).toBe('Winter sale');
    expect(outputText({ output: { subjects: ['a'] } })).toBe(
      '{\n  "subjects": [\n    "a"\n  ]\n}'
    );
    expect(outputText({ error: 'CALL_FAILED' })).toBe('');
    expect(outputText(null)).toBe('');
  });

  it('reaches the routes of a skill and of an expertise version', () => {
    expect(
      aiVersionAction('skill', 'redaction.subject-ideas', 1, 3, 'guard')
    ).toBe('/ai-skills/redaction.subject-ideas/versions/1.3/guard');
    expect(
      aiVersionAction(
        'expertise',
        'redaction.subject-line',
        2,
        2,
        'publication'
      )
    ).toBe('/ai-expertise/redaction.subject-line/versions/2.2/publication');
  });

  it.each(['en', 'fr'])('has its words in %s', (l) => {
    const locale = fs.readFileSync(
      path.join(__dirname, `../../../packages/ui/helpers/locales/${l}.js`),
      'utf8'
    );
    const start = locale.indexOf('publicationGuard: {');
    expect(start).toBeGreaterThan(-1);
    const section = locale.slice(start, locale.indexOf('\n    },', start));
    [
      'title',
      'usedBy',
      'calls',
      'notReplayed',
      'missing',
      'run',
      'expected',
      'before',
      'after',
      'publish',
      'cancel',
      'OUTPUT_CONTRACT',
      'CALL_FAILED',
    ].forEach((key) => expect(section).toMatch(new RegExp(`\\b${key}:`)));
    expect(locale).toMatch(/SKILL_PUBLICATION_GUARD_REQUIRED:/);
  });

  // What the guard showed is the server's: the page hands back its key.
  it.each([
    'packages/ui/components/ai-skill/bs-ai-publication-guard-modal.vue',
    'packages/ui/components/ai-skill/bs-ai-publish-drafts.vue',
  ])('%s publishes and cancels with the key of the guard', (file) => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../..', file),
      'utf8'
    );

    expect(source).toMatch(/guardKey: this\.guard/);
    expect(source).not.toMatch(/\bguard: this\.guard\b/);
  });

  // The server answers a code, never a sentence (ERROR_CODES).
  it.each(['en', 'fr'])('words in %s every code a publication answers', (l) => {
    const {
      aiSkills,
    } = require(`../../../packages/ui/helpers/locales/${l}.js`).default;
    const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
    Object.keys(ERROR_CODES)
      .filter((code) => /^SKILLS?_PUBLICATION_/.test(code))
      .forEach((code) =>
        expect([code, aiSkills.errors[code]]).toEqual([
          code,
          expect.any(String),
        ])
      );
  });
});
