'use strict';

/**
 * The two texts written at every publication of a skill or an expertise (ADR
 * 0031, amending ADR 0014): the release note, for every company that reads
 * the item, and the change log, for the platform company alone. A minor
 * version used to get a generic sentence by default: it says nothing, so it
 * is no release note, read or written.
 */

const createError = require('http-errors');
const { LegacyMinorVersionTexts } = require('../constant/skill-constants.js');

const MAX_RELEASE_NOTE_LENGTH = 500;

const said = (text, generic) => {
  const trimmed = String(text || '').trim();
  return trimmed && trimmed !== generic ? trimmed : null;
};

/** What a version's release note says, or null when it says nothing. */
const releaseNoteOf = (version) =>
  said(version && version.releaseNotes, LegacyMinorVersionTexts.releaseNotes);

/** What a version's change log says, or null when it says nothing. */
const changeLogOf = (version) =>
  said(version && version.changelog, LegacyMinorVersionTexts.changelog);

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
