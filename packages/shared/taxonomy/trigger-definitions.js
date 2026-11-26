'use strict';

// The doctrine's words for the trigger's two values (ADR 0032), defined once:
// the taxonomy screen shows them to the admin, the editor to whoever picks the
// value, and the server hands them to the AI through the governance context.
// The admin reads what the model reads.
//
// Keyed by language, then by the values of EMAIL_TRIGGERS (constants.js); a
// test checks the keys still match those values. Written as literal keys
// rather than computed ones, and with no spread: the UI's build compiles this
// file, and an injected Babel helper import would turn it into a module that
// can no longer use `module.exports`.

const EMAIL_TRIGGER_DEFINITIONS = Object.freeze({
  fr: Object.freeze({
    adhoc: Object.freeze({
      label: 'Ad hoc',
      description:
        "Quelqu'un a décidé de cet envoi-là, cette fois-ci. Une infolettre écrite et programmée chaque semaine reste ad hoc.",
    }),
    automated: Object.freeze({
      label: 'Automatisé',
      description:
        "Une règle décide de l'envoi, à chaque fois. Si personne ne touche à rien, l'email partira encore dans six mois.",
    }),
  }),
  en: Object.freeze({
    adhoc: Object.freeze({
      label: 'One Shot',
      description:
        'Someone decided this particular send, this once. A newsletter written and scheduled every week is still one shot.',
    }),
    automated: Object.freeze({
      label: 'Automated',
      description:
        'A rule decides the send, every time. If nobody touches anything, the email will still go out in six months.',
    }),
  }),
});

module.exports = { EMAIL_TRIGGER_DEFINITIONS };
