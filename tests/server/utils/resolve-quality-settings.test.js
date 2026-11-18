'use strict';

// The quality settings the editor applies to a mailing: its template's
// overrides, then its group's settings, then the catalogue's defaults, one
// setting at a time (epic #1193, ADR 0009).

let resolveQualitySettings;
let adjustedThresholds;

function load() {
  ({
    resolveQualitySettings,
    adjustedThresholds,
  } = require('../../../packages/server/utils/resolve-quality-settings.js'));
}

describe('resolveQualitySettings — a group', () => {
  beforeAll(load);

  it("gives every check its default when nothing is set: today's behavior", () => {
    const resolved = resolveQualitySettings(null, null);
    expect(resolved.checks.headings).toEqual({ state: 'on', thresholds: {} });
    expect(resolved.checks['tracking-params'].state).toBe('blocking');
    expect(resolved.checks.subject.thresholds).toEqual({
      long: 40,
      tooLong: 60,
    });
  });

  it("applies the group's check states", () => {
    const group = {
      qualitySettings: {
        checks: {
          headings: { state: 'off' },
          'unfilled-links': { state: 'blocking' },
        },
      },
    };
    const resolved = resolveQualitySettings(group, null);
    expect(resolved.checks.headings.state).toBe('off');
    expect(resolved.checks['unfilled-links'].state).toBe('blocking');
    expect(resolved.checks['emoji-placement'].state).toBe('on');
  });

  it("applies the group's thresholds, the others keeping their default", () => {
    const group = {
      qualitySettings: { checks: { subject: { thresholds: { long: 30 } } } },
    };
    expect(
      resolveQualitySettings(group, null).checks.subject.thresholds
    ).toEqual({ long: 30, tooLong: 60 });
  });
});

describe('resolveQualitySettings — a template over its group', () => {
  beforeAll(load);

  const group = {
    qualitySettings: {
      checks: {
        headings: { state: 'off' },
        'small-font': { thresholds: { minSize: 13 } },
      },
    },
  };

  it('takes the setting the template overrides, and the group for the rest', () => {
    const template = {
      qualitySettings: {
        checks: { 'small-font': { thresholds: { minSizeHeaderFooter: 10 } } },
      },
    };
    const resolved = resolveQualitySettings(group, template);
    expect(resolved.checks['small-font'].thresholds).toEqual({
      minSize: 13,
      minSizeHeaderFooter: 10,
    });
    expect(resolved.checks.headings.state).toBe('off');
  });

  it('lets a template turn back on a check its group turned off', () => {
    const template = {
      qualitySettings: { checks: { headings: { state: 'on' } } },
    };
    expect(resolveQualitySettings(group, template).checks.headings.state).toBe(
      'on'
    );
  });

  it('follows the group for whatever the template does not set', () => {
    const template = { qualitySettings: { checks: {} } };
    const later = {
      qualitySettings: { checks: { headings: { state: 'blocking' } } },
    };
    expect(resolveQualitySettings(later, template).checks.headings.state).toBe(
      'blocking'
    );
  });

  it('reads Mongoose sub-documents as well as plain objects', () => {
    const asDocument = {
      qualitySettings: {
        toObject: () => ({ checks: { headings: { state: 'off' } } }),
      },
    };
    expect(resolveQualitySettings(asDocument, null).checks.headings.state).toBe(
      'off'
    );
  });
});

// What is stored may not have gone through the sanitizer (a super admin
// writing the field directly): only catalogue keys and known states apply,
// and nothing is ever written outside the result (security review).
describe('resolveQualitySettings — what is stored, read defensively', () => {
  beforeAll(load);

  it('ignores inherited names, unknown states and junk', () => {
    const group = {
      qualitySettings: {
        checks: {
          constructor: { state: 'off' },
          toString: { state: 'off' },
          headings: { state: 'loud', thresholds: 'x' },
          subject: { thresholds: { constructor: 5, long: '30' } },
        },
      },
    };
    const resolved = resolveQualitySettings(group, { qualitySettings: 'x' });
    expect(resolved.checks.headings.state).toBe('on');
    expect(resolved.checks.subject.thresholds).toEqual({
      long: 40,
      tooLong: 60,
    });
    expect(Object.state).toBeUndefined();
    expect(Object.prototype.toString.state).toBeUndefined();
  });
});

// A group changes its thresholds without its templates being checked again: a
// template's own threshold then wins over an inherited one it contradicts,
// the inherited value brought to the template's.
describe("resolveQualitySettings — a template's threshold over an inherited one", () => {
  beforeAll(load);

  const settings = (checkId, thresholds) => ({
    qualitySettings: { checks: { [checkId]: { thresholds } } },
  });
  const resolve = (group, template, checkId) => ({
    thresholds: resolveQualitySettings(group, template).checks[checkId]
      .thresholds,
    adjusted: adjustedThresholds(group, template),
  });

  it("keeps the template's warning when its group raises the lower level past it", () => {
    // The template set tooLong 50 over the group's long 40; the group then
    // moved long to 70.
    const group = settings('subject', { long: 70, tooLong: 90 });
    const template = settings('subject', { tooLong: 50 });

    expect(resolve(group, template, 'subject')).toEqual({
      thresholds: { long: 50, tooLong: 50 },
      adjusted: [
        { checkId: 'subject', threshold: 'long', inherited: 70, value: 50 },
      ],
    });
  });

  it("keeps the template's lower level when its group lowers the higher one under it", () => {
    const group = settings('subject', { tooLong: 45 });
    const template = settings('subject', { long: 55 });

    expect(resolve(group, template, 'subject')).toEqual({
      thresholds: { long: 55, tooLong: 55 },
      adjusted: [
        { checkId: 'subject', threshold: 'tooLong', inherited: 45, value: 55 },
      ],
    });
  });

  it('applies to the total image weight as well', () => {
    const group = settings('images-total-weight', {
      warningKb: 200,
      errorKb: 300,
    });
    const template = settings('images-total-weight', { warningKb: 400 });

    expect(resolve(group, template, 'images-total-weight')).toEqual({
      thresholds: { warningKb: 400, errorKb: 400 },
      adjusted: [
        {
          checkId: 'images-total-weight',
          threshold: 'errorKb',
          inherited: 300,
          value: 400,
        },
      ],
    });
  });

  it('brings a default the template contradicts to its value', () => {
    // errorKb 400 was set over a group's warning of 300, since cleared: the
    // default warning of 500 is inherited again.
    const template = settings('images-total-weight', { errorKb: 400 });

    expect(resolve(null, template, 'images-total-weight')).toEqual({
      thresholds: { warningKb: 400, errorKb: 400 },
      adjusted: [
        {
          checkId: 'images-total-weight',
          threshold: 'warningKb',
          inherited: 500,
          value: 400,
        },
      ],
    });
  });

  it('changes nothing when the pair is in order', () => {
    const group = settings('subject', { long: 30 });
    const template = settings('subject', { tooLong: 50 });

    expect(resolve(group, template, 'subject')).toEqual({
      thresholds: { long: 30, tooLong: 50 },
      adjusted: [],
    });
  });

  it('leaves two values of the same level as they are', () => {
    // Both written together, so checked together: nothing to arbitrate.
    const misordered = { long: 70, tooLong: 50 };
    expect(resolve(null, settings('subject', misordered), 'subject')).toEqual({
      thresholds: misordered,
      adjusted: [],
    });
    expect(resolve(settings('subject', misordered), null, 'subject')).toEqual({
      thresholds: misordered,
      adjusted: [],
    });
  });
});
