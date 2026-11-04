'use strict';

// Publishing several drafts at once from the lists (ADR 0019, #1431): which
// rows can be selected, what the export and the batch take of a selection,
// the words of what was left out or failed, in both languages. The project
// has no @vue/test-utils: the rules live in this helper.

const fs = require('fs');
const path = require('path');

const {
  PUBLISH_SKIP_REASONS,
  PUBLISH_FAILURE_REASONS,
  isSelectable,
  exportableOf,
  batchItems,
  batchNeedsGuard,
  skipReasonKey,
  failureReasonKey,
  itemLabel,
} = require('~/helpers/publish-drafts.js');

const ACTIVE = {
  skillId: 'redaction.subject-ideas',
  status: 'ACTIVE',
  activeVersion: { major: 1, minor: 2 },
};
const NEVER_PUBLISHED = {
  skillId: 'qc.unreleased',
  status: 'DRAFT',
  activeVersion: { major: null, minor: 0 },
};
const ARCHIVED = {
  skillId: 'qc.old',
  status: 'ARCHIVED',
  activeVersion: { major: 1, minor: 0 },
};

describe('publishing several drafts at once', () => {
  it('lets the person select what has an active version, or was never published', () => {
    expect(isSelectable(ACTIVE)).toBe(true);
    expect(isSelectable(NEVER_PUBLISHED)).toBe(true);
    expect(isSelectable(ARCHIVED)).toBe(false);
  });

  it('exports only what has an active version', () => {
    expect(exportableOf([ACTIVE, NEVER_PUBLISHED, ARCHIVED])).toEqual([ACTIVE]);
  });

  it('sends the selection as kinds and identifiers', () => {
    expect(batchItems('skill', [ACTIVE, NEVER_PUBLISHED], 'skillId')).toEqual([
      { kind: 'skill', id: 'redaction.subject-ideas' },
      { kind: 'skill', id: 'qc.unreleased' },
    ]);
  });

  it('runs the guard only when a feature uses one of the drafts', () => {
    expect(batchNeedsGuard({ usedBy: [{ featureType: 'x' }] })).toBe(true);
    expect(batchNeedsGuard({ usedBy: [] })).toBe(false);
    expect(batchNeedsGuard(null)).toBe(false);
  });

  it('words a reason of its own, whatever the server sent', () => {
    expect(skipReasonKey('several_drafts')).toBe(
      'aiSkills.publishDrafts.skipped.several_drafts'
    );
    expect(failureReasonKey('guard_required')).toBe(
      'aiSkills.publishDrafts.failures.guard_required'
    );
    expect(failureReasonKey('something new')).toBe(
      'aiSkills.publishDrafts.failures.failed'
    );
  });

  it('names an item with its version', () => {
    expect(
      itemLabel({ id: 'redaction.subject-line', version: { major: 2, minor: 2 } })
    ).toBe('redaction.subject-line v2.2');
  });

  it.each(['en', 'fr'])('has its words in %s', (l) => {
    const locale = fs.readFileSync(
      path.join(__dirname, `../../../packages/ui/helpers/locales/${l}.js`),
      'utf8'
    );
    const start = locale.indexOf('publishDrafts: {');
    expect(start).toBeGreaterThan(-1);
    const section = locale.slice(start, locale.indexOf('\n    },', start));
    [
      'action',
      'title',
      'targets',
      'nothing',
      'publish',
      'report',
      ...PUBLISH_SKIP_REASONS,
      ...PUBLISH_FAILURE_REASONS,
    ].forEach((key) => expect(section).toMatch(new RegExp(`\\b${key}:`)));
  });
});
