'use strict';

/**
 * What LePatron measures and checks on a proposal, in code.
 *
 * A model judges wording; it does not count. The same 57-character subject was
 * once announced as 62 then 58. So every fact shown to the user is computed
 * here, and every rule that can be checked mechanically is enforced here: a
 * proposal that breaks one is dropped before the user sees it. Length is shown,
 * never used to drop: a long subject is a judgment call, an invented variable
 * is a bug.
 */

// Personalization variables of the ESPs our clients use: {{x}}, %%x%%, *|x|*,
// [[x]]. Same list as the quality control of the editor.
const VARIABLE_PATTERN = /\{\{[^}]*\}\}|%%[^%]*%%|\*\|[^|]*\|\*|\[\[[^\]]*\]\]/g;

// Emoji, without ©, ® and ™: they are pictographic for Unicode, letters for a
// reader.
const EMOJI_PATTERN = /(?![©®™])\p{Extended_Pictographic}/gu;

// A subject dressed as a reply or a forward. Gmail's sender guidelines forbid
// it. Same prefixes as the quality control of the editor.
const FAKE_PREFIX_PATTERN = /^\s*(re|fw|fwd|tr|aw|wg|rv|sv|vs|r|odp|antw)\s*:/i;

// What a mobile inbox shows of a subject.
const SUBJECT_MOBILE_LENGTH = 35;

// Below, some inboxes complete the preview with the start of the body; above,
// the end is rarely read. The doctrine of the preheader expertise.
const PREHEADER_SHORT = 40;
const PREHEADER_LONG = 90;

const characters = (text) => Array.from(text);

/**
 * Length as the reader sees it: a variable's value is only known at send time,
 * so it does not count.
 */
function visibleLength(text) {
  return characters(text.replace(VARIABLE_PATTERN, '').trim()).length;
}

function variablesIn(text) {
  return text.match(VARIABLE_PATTERN) || [];
}

function emojisIn(text) {
  return text.match(EMOJI_PATTERN) || [];
}

const startsWithEmoji = (text) => {
  const first = characters(text.trim())[0];
  return Boolean(first) && emojisIn(first).length > 0;
};

function subjectFacts(text) {
  const length = visibleLength(text);
  return {
    length,
    mobilePreview: characters(text).slice(0, SUBJECT_MOBILE_LENGTH).join(''),
    truncatedOnMobile: length > SUBJECT_MOBILE_LENGTH,
  };
}

function preheaderFacts(text) {
  const length = visibleLength(text);
  return {
    length,
    tooShort: length < PREHEADER_SHORT,
    tooLong: length > PREHEADER_LONG,
  };
}

// Rules shared by every kind of proposal.
function breaksCommonRule(text, contentText) {
  return (
    FAKE_PREFIX_PATTERN.test(text) ||
    // A variable the email does not use would break at send time.
    variablesIn(text).some((variable) => !contentText.includes(variable))
  );
}

const KINDS = {
  subject: {
    facts: subjectFacts,
    // One emoji at most, never first: a screen reader reads it aloud, and first
    // it is read before the subject itself.
    breaksRule: (text) => startsWithEmoji(text) || emojisIn(text).length > 1,
  },
  preheader: {
    facts: preheaderFacts,
    // The emoji the doctrine allows belongs to the end of the subject.
    breaksRule: (text) => emojisIn(text).length > 0,
  },
};

/**
 * Keep the proposals that respect the rules, each with its facts.
 *
 * @param {'subject'|'preheader'} kind
 * @param {Array<{text: string, angle: string}>} proposals as the skill returned them
 * @param {Array<{text: string}>} content the email copy the skill was given
 * @returns {{ proposals: Array<{text, angle, facts}>, dropped: number }}
 */
function screenProposals(kind, proposals, content) {
  const { facts, breaksRule } = KINDS[kind];
  const contentText = content.map((piece) => piece.text).join('\n');
  const kept = proposals
    .filter(
      ({ text }) => !breaksCommonRule(text, contentText) && !breaksRule(text)
    )
    .map(({ text, angle }) => ({ text, angle, facts: facts(text) }));
  return { proposals: kept, dropped: proposals.length - kept.length };
}

module.exports = {
  screenProposals,
  visibleLength,
  SUBJECT_MOBILE_LENGTH,
  PREHEADER_SHORT,
  PREHEADER_LONG,
};
