'use strict';

/**
 * What LePatron measures and checks on a proposal, in code.
 *
 * A model judges wording; it does not count. The same 57-character subject was
 * once announced as 62 then 58. So every fact shown to the user is computed
 * here, and every rule that can be checked mechanically is enforced here: a
 * proposal that breaks one is dropped before the user sees it. Length is shown,
 * never used to drop — except past the limit of the field it would go into.
 *
 * The measures and the rules are the quality control's (packages/shared/quality):
 * once applied, a proposal gets the verdict it was shown with.
 */

const {
  MAX_SUBJECT_LENGTH,
} = require('../mailing/mailing-metadata.service.js');
const {
  CHECKS,
  defaultQualitySettings,
} = require('../../shared/quality/checks.js');
const {
  countEmojis,
  startsWithEmoji,
} = require('../../shared/quality/emoji.js');
const {
  BRACKETED_WORD,
  mergeTagsIn,
  stripMergeTags,
} = require('../../shared/quality/merge-tag-syntax.js');
const {
  inboxLength,
  inboxStart,
  fakeReplyPrefix,
  repeatsSubject,
} = require('../../shared/quality/copy-rules.js');

// Forms a model invents when it means a variable — {prenom}, %prenom% — but no
// ESP of ours reads. Looked for once the real tags are out, and checked like
// them, so one the email does not use drops the proposal.
const SUSPECTED_VARIABLE_PATTERN = /\{[A-Za-z_][\w.]{0,50}\}|%[A-Za-z_][\w.]{0,50}%/g;

// What a mobile inbox shows of a subject.
// How many proposals the feature shows, side by side.
const SHOWN = 3;

const SUBJECT_MOBILE_LENGTH = 35;

// No company may accept a longer preheader (the bound of its `tooLong`
// threshold): past it, the text is no preview any more.
const MAX_PREHEADER_LENGTH = CHECKS.preheader.thresholds.tooLong.max;

// `{{ Prenom }}` and `{{prenom}}` are the same variable to an ESP that ignores
// case and spaces, and a model writes either.
const normalizeVariable = (variable) =>
  variable.replace(/\s+/g, '').toLowerCase();

function variablesIn(text) {
  return [
    ...mergeTagsIn(text),
    ...(stripMergeTags(text).match(SUSPECTED_VARIABLE_PATTERN) || []),
  ];
}

/**
 * The facts of a subject. The mobile preview is cut from the text the length
 * counts — variables out, their value only known at send time — so that it
 * holds the 35 characters the length speaks of.
 */
function subjectFacts(text) {
  const length = inboxLength(text);
  return {
    length,
    mobilePreview: inboxStart(text, SUBJECT_MOBILE_LENGTH),
    truncatedOnMobile: length > SUBJECT_MOBILE_LENGTH,
  };
}

/**
 * The facts of a preheader, with the signals of the quality control's
 * preheader check: `long` past its `long` threshold, `tooLong` past its
 * `tooLong` one, both as the mailing's settings resolve them. A short
 * preheader is never signalled, as the quality control never reports one.
 */
function preheaderFacts(text, qualitySettings) {
  const length = inboxLength(text);
  const { state, thresholds } = qualitySettings.checks.preheader;
  if (state === 'off') return { length, long: false, tooLong: false };
  // Read in order, as the editor does: a template may set one on the other
  // side of its group's.
  const long = Math.min(thresholds.long, thresholds.tooLong);
  const tooLong = Math.max(thresholds.long, thresholds.tooLong);
  return { length, long: length > long, tooLong: length > tooLong };
}

const KINDS = {
  subject: {
    facts: subjectFacts,
    breaksRule: (text) =>
      // One emoji at most, never first: a screen reader reads it aloud, and
      // first it is read before the subject itself.
      startsWithEmoji(text) ||
      countEmojis(text) > 1 ||
      // Saving the email metadata refuses it.
      text.length > MAX_SUBJECT_LENGTH,
  },
  preheader: {
    facts: preheaderFacts,
    breaksRule: (text, { subject }) =>
      // The emoji the doctrine allows belongs to the end of the subject.
      countEmojis(text) > 0 ||
      inboxLength(text) > MAX_PREHEADER_LENGTH ||
      // Inboxes show both side by side: the reader would read it twice.
      Boolean(subject && repeatsSubject(text, subject)),
  },
};

/**
 * Keep the proposals that respect the rules, each with its facts.
 *
 * @param {'subject'|'preheader'} kind
 * @param {Array<{text: string, angle: string}>} proposals as the skill returned them
 * @param {Object} context
 * @param {string[]} context.sources every text the skill was given that may hold
 *   a variable worth reusing: the email copy, the current subject…
 * @param {string[]} [context.avoid] proposals the user already saw
 * @param {string} [context.subject] the subject the user picked, which a
 *   preheader must not repeat
 * @param {Object} [context.qualitySettings] the mailing's resolved quality
 *   settings; the defaults when absent
 * @returns {{ proposals: Array<{text, angle, facts}>, dropped: number,
 *   repeated: number }} `dropped`: proposals that broke a rule; `repeated`:
 *   duplicates and proposals the user already saw
 */
function screenProposals(
  kind,
  proposals,
  { sources, avoid = [], subject, qualitySettings = defaultQualitySettings() }
) {
  const { facts, breaksRule } = KINDS[kind];
  const known = new Set(
    sources.flatMap((source) => variablesIn(source)).map(normalizeVariable)
  );
  // A variable the email does not use would break at send time. `[x]` is
  // only read as one when the email uses it: "[IMPORTANT] Incident" is a
  // legitimate subject.
  const unknownVariable = (variable) =>
    !known.has(normalizeVariable(variable)) && !BRACKETED_WORD.test(variable);
  const seen = new Set(avoid.map((text) => text.trim()));

  const kept = [];
  let dropped = 0;
  let repeated = 0;
  proposals.forEach(({ text, angle }) => {
    const breaks =
      fakeReplyPrefix(text) !== null ||
      breaksRule(text, { subject }) ||
      variablesIn(text).some(unknownVariable);
    if (breaks) {
      dropped += 1;
      return;
    }
    // "Suggest others" must not offer what the user already saw, twice.
    if (seen.has(text.trim())) {
      repeated += 1;
      return;
    }
    seen.add(text.trim());
    kept.push({ text, angle, facts: facts(text, qualitySettings) });
  });
  // Three are shown, the first that respect the rules: a model sometimes
  // answers more than it was asked for. The others are not counted as set
  // aside: nothing was wrong with them.
  return { proposals: kept.slice(0, SHOWN), dropped, repeated };
}

module.exports = {
  screenProposals,
  SUBJECT_MOBILE_LENGTH,
  MAX_PREHEADER_LENGTH,
};
