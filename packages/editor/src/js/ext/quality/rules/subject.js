'use strict';

const { countEmojis } = require('../emoji');
const { inboxLength } = require('../copy-fields');
const { orderedThresholds } = require('../settings');

// Truncation, not performance: subject length does not change read rates
// (Return Path, 9 million subjects). Team decision of 1 October 2026: under 40
// characters ideally, never over 60 (thresholds `long` and `tooLong`, set by
// the group's quality settings).

// Reply and forward prefixes, in the languages our clients write in. Gmail
// asks not to fake them. A prefix of one or two letters must end the word
// ("RE: offer"): "Re:Think" and "re:boot" are brand names.
const SHORT_PREFIX = /^\s*(re|fw|tr|aw|wg|rv|sv|vs|r)\s*:(?=\s|$)/i;
const LONG_PREFIX = /^\s*(fwd|odp|antw)\s*:/i;
const fakeReply = (subject) =>
  SHORT_PREFIX.exec(subject) || LONG_PREFIX.exec(subject);
const REPEATED_PUNCTUATION = /(!{2,}|\?{2,}|\${2,}|€{2,})/;
const MIN_LETTERS_FOR_CAPS = 8;
const CAPS_RATIO = 0.7;

function capsRatio(text) {
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length < MIN_LETTERS_FOR_CAPS) return 0;
  return letters.filter((l) => l !== l.toLowerCase()).length / letters.length;
}

// What makes a subject look like spam, or null (an info, never blocking).
function aggressiveness(subject) {
  if (capsRatio(subject) > CAPS_RATIO)
    return 'Subject mostly in capital letters';
  if (REPEATED_PUNCTUATION.test(subject)) {
    return 'Subject repeats punctuation (!!, ??, $$)';
  }
  if (countEmojis(subject) > 1) {
    return 'Subject has more than one emoji';
  }
  return null;
}

module.exports = {
  id: 'subject',
  category: 'copy',
  severity: 'warning',
  titleKey: 'quality-title-subject',
  passKey: 'The subject is filled in and __count__ characters long',
  // The ESP holds the subject: nothing to pass, the check is not listed.
  enabled: (ctx) => ctx.subject !== null,
  passParams: (ctx) => ({ count: inboxLength(ctx.subject || '') }),
  run(ctx) {
    const raw = ctx.subject;
    if (raw === null) return [];
    const subject = raw.trim();
    if (!subject) {
      return [{ messageKey: 'No subject', value: '' }];
    }
    const findings = [];
    const count = inboxLength(subject);
    const [long, tooLong] = orderedThresholds(
      ctx,
      'subject',
      'long',
      'tooLong'
    );
    if (count > tooLong) {
      findings.push({
        messageKey:
          'Subject too long (__count__ characters): inboxes cut it, keep it under __max__',
        params: { count, max: tooLong },
      });
    } else if (count > long) {
      findings.push({
        messageKey:
          'Long subject (__count__ characters): ideally under __max__, it may be cut on mobile',
        severity: 'info',
        params: { count, max: long },
      });
    }
    const prefix = fakeReply(subject);
    if (prefix) {
      findings.push({
        messageKey:
          'Subject starts like a reply or a forward (__prefix__) without being one',
        params: { prefix: prefix[0].trim() },
      });
    }
    const aggressive = aggressiveness(subject);
    if (aggressive) findings.push({ messageKey: aggressive, severity: 'info' });
    return findings.map((finding) => ({ ...finding, value: subject }));
  },
};
