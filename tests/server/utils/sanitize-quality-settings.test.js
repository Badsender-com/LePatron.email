'use strict';

// What the quality settings routes rely on to keep the required tracking
// parameters a tech admin's (ADR 0009): the comparison with what is stored,
// and the writes that leave the checks a save did not change alone.

const {
  sanitizeQualitySettings,
  keepsTechChecks,
  qualitySettingsUpdate,
} = require('../../../packages/server/utils/sanitize-quality-settings.js');

const CHECKS = 'qualitySettings.checks';

describe('keepsTechChecks', () => {
  it('holds when nothing is stored and nothing set', () => {
    expect(keepsTechChecks(undefined, { checks: {} })).toBe(true);
    expect(keepsTechChecks({ checks: 'odd' }, { checks: {} })).toBe(true);
  });

  it('holds for the same values, whatever the order of their keys', () => {
    const stored = {
      checks: { 'tracking-params': { state: 'off', thresholds: {} } },
    };
    const next = {
      checks: { 'tracking-params': { thresholds: {}, state: 'off' } },
    };
    expect(keepsTechChecks(stored, next)).toBe(true);
  });

  it('fails when the check is set, changed or removed', () => {
    const off = { checks: { 'tracking-params': { state: 'off' } } };
    const on = { checks: { 'tracking-params': { state: 'on' } } };
    expect(keepsTechChecks({ checks: {} }, off)).toBe(false);
    expect(keepsTechChecks(off, on)).toBe(false);
    expect(keepsTechChecks(off, { checks: {} })).toBe(false);
  });

  it('compares with what is stored, which the merge leaves as it was', () => {
    // The template route compares the stored value with the merged one: a
    // merge that changed the stored object in place would always compare
    // equal.
    const stored = { checks: { 'tracking-params': { state: 'off' } } };
    const next = sanitizeQualitySettings(
      { checks: { 'tracking-params': { state: null } } },
      stored
    );
    expect(stored).toEqual({
      checks: { 'tracking-params': { state: 'off' } },
    });
    expect(keepsTechChecks(stored, next)).toBe(false);
  });
});

describe('qualitySettingsUpdate', () => {
  it('writes only the checks that changed', () => {
    const stored = {
      checks: { headings: { state: 'off' }, subject: { state: 'on' } },
    };
    const next = {
      checks: { headings: { state: 'off' }, subject: { state: 'blocking' } },
    };
    expect(qualitySettingsUpdate(stored, next)).toEqual({
      $set: { [`${CHECKS}.subject`]: { state: 'blocking' } },
    });
  });

  it('removes the checks the merge left out', () => {
    expect(
      qualitySettingsUpdate(
        { checks: { headings: { state: 'off' } } },
        { checks: {} }
      )
    ).toEqual({ $unset: { [`${CHECKS}.headings`]: '' } });
  });

  it('writes into settings not stored yet', () => {
    expect(
      qualitySettingsUpdate(undefined, {
        checks: { headings: { state: 'off' } },
      })
    ).toEqual({ $set: { [`${CHECKS}.headings`]: { state: 'off' } } });
  });

  it('writes nothing when nothing changed', () => {
    const stored = { checks: { headings: { state: 'off' } } };
    expect(
      qualitySettingsUpdate(stored, { checks: { ...stored.checks } })
    ).toEqual({});
  });

  it('replaces settings of another shape as a whole', () => {
    const next = { checks: { headings: { state: 'off' } } };
    expect(qualitySettingsUpdate('odd', next)).toEqual({
      $set: { qualitySettings: next },
    });
    expect(qualitySettingsUpdate({ checks: [] }, next)).toEqual({
      $set: { qualitySettings: next },
    });
  });
});
