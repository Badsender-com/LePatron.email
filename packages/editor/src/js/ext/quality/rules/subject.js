'use strict';

const { countEmojis } = require('../emoji');

// Truncation, not performance: subject length does not change read rates
// (Return Path, 9 million subjects). Team decision of 1 October 2026: under 40
// characters ideally, never over 60.
const LONG = 40;
const TOO_LONG = 60;

// Reply and forward prefixes, in the languages our clients write in. Gmail
// asks not to fake them.
const FAKE_REPLY = /^\s*(re|fw|fwd|tr|aw|wg|rv|sv|vs|r|odp|antw)\s*:/i;
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
  if (capsRatio(subject) > CAPS_RATIO) return 'Subject mostly in capital letters';
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
  titleKey: 'Subject',
  passKey: 'The subject is filled in and __count__ characters long',
  LONG,
  TOO_LONG,
  passParams: (ctx) => ({
    count: Array.from((ctx.subject || '').trim()).length,
  }),
  run(ctx) {
    const raw = ctx.subject;
    if (raw === null) return []; // the ESP holds the subject
    const subject = raw.trim();
    if (!subject) {
      return [{ messageKey: 'No subject', value: '' }];
    }
    const findings = [];
    const count = Array.from(subject).length;
    if (count > TOO_LONG) {
      findings.push({
        messageKey:
          'Subject too long (__count__ characters): inboxes cut it, keep it under 60',
        params: { count },
      });
    } else if (count > LONG) {
      findings.push({
        messageKey:
          'Long subject (__count__ characters): ideally under 40, it may be cut on mobile',
        severity: 'info',
        params: { count },
      });
    }
    if (FAKE_REPLY.test(subject)) {
      findings.push({
        messageKey: 'Subject starts like a reply or a forward (__prefix__) without being one',
        params: { prefix: FAKE_REPLY.exec(subject)[0].trim() },
      });
    }
    const aggressive = aggressiveness(subject);
    if (aggressive) findings.push({ messageKey: aggressive, severity: 'info' });
    return findings.map((finding) => ({ ...finding, value: subject }));
  },
};
