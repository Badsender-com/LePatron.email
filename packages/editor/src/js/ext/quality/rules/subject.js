'use strict';

const { countEmojis } = require('../../../../../../shared/quality/emoji.js');
const {
  inboxLength,
  fakeReplyPrefix,
} = require('../../../../../../shared/quality/copy-rules.js');
const { orderedThresholds } = require('../settings');

// Truncation, not performance: subject length does not change read rates
// (Return Path, 9 million subjects). Team decision of 1 October 2026: under 40
// characters ideally, never over 60 (thresholds `long` and `tooLong`, set by
// the company's quality settings).

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
  levels: ['info', 'warning'],
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
    const prefix = fakeReplyPrefix(subject);
    if (prefix) {
      findings.push({
        messageKey:
          'Subject starts like a reply or a forward (__prefix__) without being one',
        params: { prefix },
      });
    }
    const aggressive = aggressiveness(subject);
    if (aggressive) findings.push({ messageKey: aggressive, severity: 'info' });
    return findings.map((finding) => ({ ...finding, value: subject }));
  },
};
