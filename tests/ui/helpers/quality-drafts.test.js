import {
  recommendedOf,
  exceptionsOf,
  generalOf,
} from '~/helpers/quality-exceptions.js';
import { fieldErrors } from '~/helpers/quality-save.js';
import {
  generalOfDrafts,
  keptByOf,
  referenceRows,
  templatesKeepingOwn,
} from '~/helpers/quality-drafts.js';

// What the general page shows of its unsaved changes (ADR 0009).

const general = {
  checks: {
    subject: { thresholds: { tooLong: 80 } },
    'merge-tags': { state: 'blocking' },
  },
};

describe('an unsaved change of the general settings', () => {
  it('applies as edited, valid numbers only', () => {
    const drafts = {
      subject: { state: null, thresholds: { long: '45', tooLong: '' } },
      headings: { state: 'off', thresholds: {} },
    };
    expect(generalOf(generalOfDrafts(drafts)).subject.thresholds).toEqual({
      long: 45,
      tooLong: 60,
    });
    expect(exceptionsOf(generalOfDrafts(drafts))).toEqual({
      subject: { state: null, thresholds: { long: 45, tooLong: null } },
      headings: { state: 'off', thresholds: {} },
    });
  });

  it('leaves out a value with an error: the save is refused until fixed', () => {
    const saved = exceptionsOf(general);
    // "long" 90 over the saved "too long" of 80, edited last.
    const drafts = {
      subject: { state: null, thresholds: { long: 90, tooLong: 80 } },
    };
    const errors = {
      subject: fieldErrors(
        'subject',
        drafts.subject,
        recommendedOf('subject'),
        'long',
        saved.subject
      ),
    };
    expect(Object.keys(errors.subject)).toEqual(['long']);
    expect(
      generalOf(generalOfDrafts(drafts, errors)).subject.thresholds
    ).toEqual({ long: 40, tooLong: 80 });
    // Out of bounds, too.
    const outOfBounds = {
      subject: { state: null, thresholds: { long: 5, tooLong: null } },
    };
    const boundErrors = {
      subject: fieldErrors(
        'subject',
        outOfBounds.subject,
        recommendedOf('subject')
      ),
    };
    expect(exceptionsOf(generalOfDrafts(outOfBounds, boundErrors))).toEqual({});
  });

  it('is no exception when it sets only the recommended values', () => {
    // Removed on save: nothing to mark as an exception.
    const drafts = {
      subject: { state: 'on', thresholds: { long: 40, tooLong: null } },
    };
    expect(exceptionsOf(generalOfDrafts(drafts))).toEqual({});
  });

  const template = (name, checks) => ({ name, qualitySettings: { checks } });
  const templates = [
    template('Own warning', { subject: { thresholds: { tooLong: 50 } } }),
    template('Own info', { subject: { thresholds: { long: 30 } } }),
    template('Own state', { subject: { state: 'off' } }),
    template('Follows', {}),
  ];
  const names = (list) => list.map((t) => t.name);

  it('names the templates that set their own value of what changed', () => {
    const drafted = { checks: { subject: { thresholds: { long: 35 } } } };
    expect(
      names(templatesKeepingOwn('subject', drafted, null, templates))
    ).toEqual(['Own info']);
  });

  it('names those whose own value the new general one contradicts', () => {
    // A general "long" of 70 is past the template's own "too long" of 50.
    const drafted = { checks: { subject: { thresholds: { long: 70 } } } };
    expect(
      names(templatesKeepingOwn('subject', drafted, null, templates))
    ).toEqual(['Own warning', 'Own info']);
  });

  it('names those with their own state when the state changes', () => {
    const drafted = { checks: { subject: { state: 'blocking' } } };
    expect(
      names(templatesKeepingOwn('subject', drafted, null, templates))
    ).toEqual(['Own state']);
  });

  it('names none while nothing changes', () => {
    expect(templatesKeepingOwn('subject', general, general, templates)).toEqual(
      []
    );
  });
});

describe('the table of every check', () => {
  it('shows what will apply, and which rows are not saved', () => {
    const drafted = generalOfDrafts({
      ...exceptionsOf(general),
      headings: { state: 'off', thresholds: {} },
    });
    const rows = referenceRows(drafted, general);
    const row = (id) => rows.find((r) => r.id === id);
    expect(row('headings')).toEqual({
      id: 'headings',
      applied: { state: 'off', thresholds: {} },
      isException: true,
      unsaved: true,
    });
    expect(row('subject')).toMatchObject({ isException: true, unsaved: false });
    expect(row('empty-blocks')).toMatchObject({
      isException: false,
      unsaved: false,
    });
  });

  it('marks a removed exception as not saved', () => {
    const rows = referenceRows(generalOfDrafts({}), general);
    expect(rows.find((r) => r.id === 'merge-tags')).toMatchObject({
      applied: { state: 'on', thresholds: {} },
      isException: false,
      unsaved: true,
    });
  });
});

describe('the templates an unsaved change will not reach, by check', () => {
  it('names them by check, none without templates', () => {
    const drafted = { checks: { subject: { thresholds: { long: 35 } } } };
    const templates = [
      {
        name: 'Own info',
        qualitySettings: { checks: { subject: { thresholds: { long: 30 } } } },
      },
    ];
    expect(keptByOf(['subject', 'headings'], drafted, null, templates)).toEqual(
      {
        subject: ['Own info'],
        headings: [],
      }
    );
    expect(keptByOf(['subject'], drafted, null, [])).toEqual({});
  });
});
