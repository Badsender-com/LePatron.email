'use strict';

const { inferStatus } = require('../../scripts/migrate-version-major-minor');

describe('migrate-version-major-minor :: inferStatus', () => {
  it('returns ACTIVE when the version number matches the activeVersion', () => {
    expect(inferStatus({ versionNumber: 2 }, 2)).toBe('ACTIVE');
  });

  it('returns ARCHIVED when activatedAt is set but the version is no longer active', () => {
    expect(inferStatus({ versionNumber: 1, activatedAt: new Date() }, 2)).toBe(
      'ARCHIVED'
    );
  });

  it('returns DRAFT for never-activated versions', () => {
    expect(inferStatus({ versionNumber: 3, activatedAt: null }, 2)).toBe(
      'DRAFT'
    );
  });

  it('returns DRAFT when there is no active version at all', () => {
    expect(inferStatus({ versionNumber: 1 }, null)).toBe('DRAFT');
    expect(inferStatus({ versionNumber: 1 }, undefined)).toBe('DRAFT');
  });

  it('keeps the existing status on an already-migrated version', () => {
    expect(
      inferStatus({ versionMajor: 1, versionMinor: 0, status: 'ACTIVE' }, 1)
    ).toBe('ACTIVE');
    expect(
      inferStatus({ versionMajor: 2, versionMinor: 1, status: 'DRAFT' }, 1)
    ).toBe('DRAFT');
  });

  it('falls back to DRAFT on an already-migrated version without status', () => {
    expect(inferStatus({ versionMajor: 1, versionMinor: 0 }, 1)).toBe('DRAFT');
  });
});
