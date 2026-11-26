'use strict';

// The release note and change log a version says (ADR 0031): the generic
// sentence a minor version used to get says nothing, as a blank text.

const {
  writtenReleaseNote,
  writtenChangeLog,
} = require('../../../packages/shared/ai-skill/release-texts.js');
const {
  LEGACY_MINOR_VERSION_TEXTS,
} = require('../../../packages/shared/ai-skill/constants.js');

describe('release texts', () => {
  it('keeps a text as it was written', () => {
    expect(writtenReleaseNote('Subjects get shorter.\n')).toBe(
      'Subjects get shorter.\n'
    );
    expect(writtenChangeLog('A reader asked for 45')).toBe(
      'A reader asked for 45'
    );
  });

  it('reads a blank or missing text as nothing', () => {
    expect(writtenReleaseNote('   ')).toBe('');
    expect(writtenReleaseNote(undefined)).toBe('');
    expect(writtenChangeLog(null)).toBe('');
  });

  it('reads the generic sentence of an older minor version as nothing', () => {
    expect(
      writtenReleaseNote(` ${LEGACY_MINOR_VERSION_TEXTS.releaseNotes} `)
    ).toBe('');
    expect(writtenChangeLog(LEGACY_MINOR_VERSION_TEXTS.changelog)).toBe('');
  });

  it('reads each generic sentence as nothing in its own field only', () => {
    expect(writtenChangeLog(LEGACY_MINOR_VERSION_TEXTS.releaseNotes)).toBe(
      LEGACY_MINOR_VERSION_TEXTS.releaseNotes
    );
  });
});
