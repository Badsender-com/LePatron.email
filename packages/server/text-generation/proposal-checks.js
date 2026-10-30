'use strict';

/**
 * What LePatron measures and checks on a proposal, in code.
 *
 * A model judges wording; it does not count. The same 57-character subject was
 * once announced as 62 then 58. So every fact shown to the user is computed
 * here, and every rule that can be checked mechanically is enforced here: a
 * proposal that breaks one is dropped before the user sees it. Length is shown,
 * never used to drop — except past the hard limit of the field it would go
 * into, where it could not be saved at all.
 */

// Personalization variables of the ESPs our clients use: {{x}}, %%x%%, *|x|*,
// [[x]]. Their value is only known at send time. Quantifiers are bounded: a
// variable name is short, and an unclosed opener must not cost a scan of the
// rest of the text from every position.
const VARIABLE_PATTERN = /\{\{[^}]{0,100}\}\}|%%[^%]{0,100}%%|\*\|[^|]{0,100}\|\*|\[\[[^\]]{0,100}\]\]/g;

// Forms a model invents when it means a variable — {prenom}, %prenom% — but no
// ESP of ours reads. Checked like variables, so one the email does not use
// drops the proposal. `[x]` is left alone: "[IMPORTANT] Incident" is a
// legitimate subject.
const SUSPECTED_VARIABLE_PATTERN = /(?<![{%])\{[A-Za-z_][\w.]{0,50}\}(?!\})|(?<!%)%[A-Za-z_][\w.]{0,50}%(?!%)/g;

// A subject dressed as a reply or a forward, colon full-width or not, counter
// or not (`Re[2]:`). Gmail's sender guidelines forbid it.
const FAKE_PREFIX_PATTERN = /^\s*(re|fw|fwd|tr|aw|wg|rv|sv|vs|r|odp|antw)(\[\d+\])?\s*[:：]/i;

// A grapheme is an emoji when it holds a pictograph, a flag letter or a keycap.
// ©, ® and ™ are pictographic for Unicode, letters for a reader.
const EMOJI_GRAPHEME = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{20E3}/u;
const NOT_EMOJI = /^[©®™]\u{FE0F}?$/u;

// What a mobile inbox shows of a subject.
const SUBJECT_MOBILE_LENGTH = 35;

// Below, some inboxes complete the preview with the start of the body; above,
// the end is rarely read. The doctrine of the preheader expertise.
const PREHEADER_SHORT = 40;
const PREHEADER_LONG = 90;

// The field a proposal goes into cannot hold more: the email metadata refuse a
// longer subject (mailing-metadata.service.js), and a preheader past this is no
// longer a preview text.
const MAX_LENGTH = 255;

const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });
const graphemes = (text) =>
  Array.from(segmenter.segment(text), ({ segment }) => segment);

/**
 * Length as the reader sees it, in characters as a reader counts them: a
 * variable's value is only known at send time, so it does not count.
 */
function visibleLength(text) {
  return graphemes(text.replace(VARIABLE_PATTERN, '').trim()).length;
}

function emojisIn(text) {
  return graphemes(text).filter(
    (grapheme) => EMOJI_GRAPHEME.test(grapheme) && !NOT_EMOJI.test(grapheme)
  );
}

const startsWithEmoji = (text) => {
  const first = graphemes(text.trim())[0];
  return Boolean(first) && emojisIn(first).length > 0;
};

// `{{ Prenom }}` and `{{prenom}}` are the same variable to an ESP that ignores
// case and spaces, and a model writes either.
const normalizeVariable = (variable) =>
  variable.replace(/\s+/g, '').toLowerCase();

function variablesIn(text) {
  return [
    ...(text.match(VARIABLE_PATTERN) || []),
    ...(text.match(SUSPECTED_VARIABLE_PATTERN) || []),
  ];
}

function subjectFacts(text) {
  const length = visibleLength(text);
  return {
    length,
    mobilePreview: graphemes(text).slice(0, SUBJECT_MOBILE_LENGTH).join(''),
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
 * @param {Object} context
 * @param {string[]} context.sources every text the skill was given that may hold
 *   a variable worth reusing: the email copy, the current subject…
 * @param {string[]} [context.avoid] proposals the user already saw
 * @returns {{ proposals: Array<{text, angle, facts}>, dropped: number }}
 */
function screenProposals(kind, proposals, { sources, avoid = [] }) {
  const { facts, breaksRule } = KINDS[kind];
  const known = new Set(
    sources.flatMap((source) => variablesIn(source)).map(normalizeVariable)
  );
  const seen = new Set(avoid.map((text) => text.trim()));

  const kept = [];
  proposals.forEach(({ text, angle }) => {
    const breaks =
      FAKE_PREFIX_PATTERN.test(text) ||
      breaksRule(text) ||
      visibleLength(text) > MAX_LENGTH ||
      // A variable the email does not use would break at send time.
      variablesIn(text).some(
        (variable) => !known.has(normalizeVariable(variable))
      ) ||
      // "Suggest others" must not offer what the user already saw, twice.
      seen.has(text.trim());
    if (breaks) return;
    seen.add(text.trim());
    kept.push({ text, angle, facts: facts(text) });
  });
  return { proposals: kept, dropped: proposals.length - kept.length };
}

module.exports = {
  screenProposals,
  visibleLength,
  SUBJECT_MOBILE_LENGTH,
  PREHEADER_SHORT,
  PREHEADER_LONG,
  MAX_LENGTH,
};
