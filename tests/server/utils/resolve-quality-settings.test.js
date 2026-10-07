'use strict';

// The quality settings the editor applies to a mailing: its template's
// overrides, then its group's settings, then the catalogue's defaults, one
// setting at a time (epic #1193, ADR 0004).

let resolveQualitySettings;

function load() {
  ({
    resolveQualitySettings,
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

// Turned on by #1199 (override settings on a template)
describe.skip('resolveQualitySettings — a template over its group', () => {
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
