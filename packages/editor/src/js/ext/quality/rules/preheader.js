'use strict';

const {
  inboxLength,
  repeatsSubject,
} = require('../../../../../../shared/quality/copy-rules.js');
const { orderedThresholds } = require('../settings');

// Thresholds weighed against real truncation and other tools (Notion, "Seuils
// objet et préheader"): Litmus and Stripo advise 90 to 100; Dyspatch sees
// clients display up to 140. A short preheader is never reported (team
// decision of 1 October 2026): it can be an editorial choice, and many
// templates fill the rest of the preview themselves.
// Thresholds `long` (100) and `tooLong` (140), set by the quality settings.

module.exports = {
  id: 'preheader',
  category: 'copy',
  severity: 'warning',
  levels: ['info', 'warning'],
  titleKey: 'quality-title-preheader',
  passKey: 'The preheader is filled in and __count__ characters long',
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
