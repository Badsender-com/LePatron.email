'use strict';

const { isDynamic, stripMergeTags } = require('../merge-tag-syntax');

// Thresholds weighed against real truncation and other tools (Notion, "Seuils
// objet et préheader"): Knak fails under 15 characters; under 40, inboxes
// complete the preview with the body; Litmus and Stripo advise 90 to 100;
// Dyspatch sees clients display up to 140.
const TOO_SHORT = 15;
const SHORT = 40;
const LONG = 100;
const TOO_LONG = 140;

// Merge tags do not count: their value is only known at send time.
const visibleLength = (text) =>
  Array.from(stripMergeTags(text).replace(/\s+/g, ' ').trim()).length;

module.exports = {
  id: 'preheader',
  category: 'copy',
  severity: 'warning',
  titleKey: 'Preheader',
  passKey: 'The preheader is filled in and __count__ characters long',
  TOO_SHORT,
  SHORT,
  LONG,
  TOO_LONG,
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
    const count = visibleLength(value);
    const finding = (messageKey, severity) => [
      { messageKey, severity, params: { count }, value },
    ];
    if (count < TOO_SHORT && !isDynamic(value)) {
      return finding('Preheader too short (__count__ characters)', 'warning');
    }
    if (count < SHORT) {
      return finding(
        'Short preheader (__count__ characters): some inboxes complete it with the body',
        'info'
      );
    }
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
    return [];
  },
};
