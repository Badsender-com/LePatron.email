'use strict';

const { stripMergeTags } = require('../merge-tag-syntax');
const { inboxLength } = require('../copy-fields');

// Thresholds weighed against real truncation and other tools (Notion, "Seuils
// objet et préheader"): Litmus and Stripo advise 90 to 100; Dyspatch sees
// clients display up to 140. A short preheader is never reported (team
// decision of 1 October 2026): it can be an editorial choice, and many
// templates fill the rest of the preview themselves.
const LONG = 100;
const TOO_LONG = 140;

// Compared without case, spacing, merge tags, accents decomposed, nor the
// punctuation and symbols around: "« Spring sale ! »" repeats "spring sale 🔥".
const normalise = (text) =>
  stripMergeTags(text)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
    .trim();

// Words are runs of letters or digits: what is left of a merge tag is none.
const wordCount = (text) => (text.match(/[\p{L}\p{N}]+/gu) || []).length;

// The preheader repeats the subject: the same words, or the subject then more.
function repeatsSubject(preheader, subject) {
  const p = normalise(preheader);
  const s = normalise(subject);
  // Two words at least: a one-word subject ("New") is only the start of many
  // preheaders.
  if (wordCount(s) < 2 || !p.startsWith(s)) return false;
  // The subject as a whole, not the start of a longer word: "Sale" is not
  // repeated by "Salesforce".
  return p.length === s.length || /^[\s\p{P}]/u.test(p.slice(s.length));
}

module.exports = {
  id: 'preheader',
  category: 'copy',
  severity: 'warning',
  titleKey: 'quality-title-preheader',
  passKey: 'The preheader is filled in and __count__ characters long',
  LONG,
  TOO_LONG,
  // A template without a preheader has nothing to pass: the check is not listed.
  enabled: (ctx) => Boolean(ctx.preheader),
  passParams: (ctx) => ({ count: inboxLength(ctx.preheader.value) }),
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
    // The template's default is the one the editor loaded: a mailing
    // translated by the AI, or a template re-uploaded with a new sample text,
    // no longer matches it, and the sample then passes as the client's.
    if (
      preheader.templateDefault &&
      value === preheader.templateDefault.trim()
    ) {
      return [
        {
          messageKey:
            'Preheader still the sample text of the template: __text__',
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
            // Its own fingerprint, tied to the subject: ignoring it must not
            // ignore "too long" as well, and a new subject brings it back.
            value: `repeats:${ctx.subject}|${value}`,
          },
        ]
      : [];
    const count = inboxLength(value);
    const finding = (messageKey, severity) =>
      findings.concat({ messageKey, severity, params: { count }, value });
    if (count > TOO_LONG) {
      return finding(
        'Preheader too long (__count__ characters): inboxes cut it well before',
        'warning'
      );
    }
    if (count > LONG) {
      return finding(
        'Long preheader (__count__ characters): its end will rarely be seen',
        'info'
      );
    }
    return findings;
  },
};
