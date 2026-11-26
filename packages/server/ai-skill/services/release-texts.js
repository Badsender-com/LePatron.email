'use strict';

/**
 * The two texts written at every publication of a skill or an expertise (ADR
 * 0031, amending ADR 0014): the release note, for every company that reads
 * the item, and the change log, for the platform company alone. A minor
 * version used to get a generic sentence by default: it says nothing, so it
 * is no release note, read or written.
 */

const createError = require('http-errors');
const {
  MAX_RELEASE_NOTE_LENGTH,
} = require('../../../shared/ai-skill/constants.js');
const {
  writtenReleaseNote,
  writtenChangeLog,
} = require('../../../shared/ai-skill/release-texts.js');

/** What a version's release note says, or null when it says nothing. */
const releaseNoteOf = (version) =>
  writtenReleaseNote(version && version.releaseNotes).trim() || null;

/** What a version's change log says, or null when it says nothing. */
const changeLogOf = (version) =>
  writtenChangeLog(version && version.changelog).trim() || null;

/**
 * Refuses a publication whose texts are missing, or whose release note is
 * too long to read in an announcement.
 *
 * @param {{ changelog?: string, releaseNotes?: string }} texts as published
 * @throws {HttpError} 400
 */
function assertReleaseTexts(texts) {
  if (!releaseNoteOf(texts)) {
    throw createError(
      400,
      'A release note (releaseNotes) is required to publish a version: what changes for whoever uses it.'
    );
  }
  if (!changeLogOf(texts)) {
    throw createError(
      400,
      'A changelog is required to publish a version: how and why it was written.'
    );
  }
  if (releaseNoteOf(texts).length > MAX_RELEASE_NOTE_LENGTH) {
    throw createError(
      400,
      `The release note is limited to ${MAX_RELEASE_NOTE_LENGTH} characters.`
    );
  }
}

module.exports = {
  MAX_RELEASE_NOTE_LENGTH,
  releaseNoteOf,
  changeLogOf,
  assertReleaseTexts,
};
