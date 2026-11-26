'use strict';

// What a version's release note and change log say (ADR 0031), read alike by
// the server, which refuses a publication without them, and by the back
// office, which leaves them blank for the person to write.
//
// No syntax that needs a Babel helper here: see constants.js.

const {
  LEGACY_MINOR_VERSION_TEXTS,
  MAX_RELEASE_NOTE_LENGTH,
} = require('./constants.js');

// A text as written, or '' when it says nothing: blank, or the generic
// sentence a minor version used to get by default.
function written(text, generic) {
  const value = text == null ? '' : String(text);
  const trimmed = value.trim();
  return trimmed && trimmed !== generic ? value : '';
}

/** A version's release note as written, or '' when it says nothing. */
function writtenReleaseNote(text) {
  return written(text, LEGACY_MINOR_VERSION_TEXTS.releaseNotes);
}

/** A version's change log as written, or '' when it says nothing. */
function writtenChangeLog(text) {
  return written(text, LEGACY_MINOR_VERSION_TEXTS.changelog);
}

/** Whether a release note is longer than an announcement reads. */
function isReleaseNoteTooLong(text) {
  return writtenReleaseNote(text).trim().length > MAX_RELEASE_NOTE_LENGTH;
}

module.exports = {
  writtenReleaseNote,
  writtenChangeLog,
  isReleaseNoteTooLong,
};
