'use strict';

const { stripMergeTags } = require('../merge-tag-syntax');
const { orderedThresholds } = require('../settings');

// Thresholds weighed against real truncation and other tools (Notion, "Seuils
// objet et préheader"): Litmus and Stripo advise 90 to 100; Dyspatch sees
// clients display up to 140. A short preheader is never reported (team
// decision of 1 October 2026): it can be an editorial choice, and many
// templates fill the rest of the preview themselves.
// Thresholds `long` (100) and `tooLong` (140), set by the quality settings.

// Compared without case, spacing, merge tags or end punctuation: "Spring
// sale!" repeats "spring sale".
const normalise = (text) =>
  stripMergeTags(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\s.!?…:;,]+$/u, '')
    .trim();

// The preheader repeats the subject: the same words, or the subject then more.
function repeatsSubject(preheader, subject) {
  const p = normalise(preheader);
  const s = normalise(subject);
  // Two words at least: a one-word subject ("New") is only the start of many
  // preheaders.
  if (s.split(' ').length < 2 || !p.startsWith(s)) return false;
  // The subject as a whole, not the start of a longer word: "Sale" is not
  // repeated by "Salesforce".
  return p.length === s.length || /^[\s\p{P}]/u.test(p.slice(s.length));
}

// Merge tags do not count: their value is only known at send time.
const visibleLength = (text) =>
  Array.from(stripMergeTags(text).replace(/\s+/g, ' ').trim()).length;

module.exports = {
  id: 'preheader',
  category: 'copy',
  severity: 'warning',
  titleKey: 'Preheader',
  passKey: 'The preheader is filled in and __count__ characters long',
  passParams: (ctx) => {
    const preheader = ctx.preheader;
    return { count: preheader ? visibleLength(preheader.value) : 0 };
  },
  run(ctx) {
    const preheader = ctx.preheader;
    if (!preheader) return [];
    const value = preheader.value.trim();
    if (preheader.turnedOff || !value) {
      return [
        {
          messageKey:
            'No preheader: inboxes show the first words of the body instead',
          value,
        },
      ];
    }
    if (preheader.templateDefault && value === preheader.templateDefault.trim()) {
      return [
        {
          messageKey: 'Preheader still the sample text of the template: __text__',
          params: { text: value },
          value,
        },
      ];
    }
    // Inboxes show the subject and the preheader side by side.
    const repeats = Boolean(ctx.subject) && repeatsSubject(value, ctx.subject);
    const findings = repeats
      ? [
          {
            messageKey:
              'The preheader repeats the subject: inboxes show the same words twice',
            value,
          },
        ]
      : [];
    const count = visibleLength(value);
    const finding = (messageKey, severity) =>
      findings.concat({ messageKey, severity, params: { count }, value });
    const [long, tooLong] = orderedThresholds(
      ctx,
      'preheader',
      'long',
      'tooLong'
    );
    if (count > tooLong) {
      return finding(
        'Preheader too long (__count__ characters): inboxes cut it well before',
        'warning'
      );
    }
    if (count > long) {
      return finding(
        'Long preheader (__count__ characters): its end will rarely be seen',
        'info'
      );
    }
    return findings;
  },
};
