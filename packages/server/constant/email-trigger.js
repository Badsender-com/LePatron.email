'use strict';

/**
 * How an email's send is decided — the second dimension of the Badsender
 * classification, independent of the email type.
 *
 * One question settles it: is there a human decision for THIS particular send?
 * Volume and recurrence do not come into it. The boundary test: if nobody touches
 * anything, will this email still go out in six months? Yes → automated. No → ad
 * hoc. A weekly newsletter written each week and scheduled on Monday is ad hoc —
 * scheduling does not remove the decision. A "new this week" digest generated every
 * Monday from the catalogue is automated, even though it goes to the whole base.
 *
 * The two dimensions are genuinely independent, and that is the point of splitting
 * them: a password reset is transactional × automated, a birthday email is
 * promotional × automated, a crisis message is institutional × ad hoc. The previous
 * vocabulary carried `marketing-automation` as an email TYPE, which forced a choice
 * between what an email brings and how it is fired.
 *
 * Unlike the email type, this is NOT a taxonomy: the doctrine admits exactly two
 * values, and a company can neither rename them nor add a third. A taxonomy would
 * offer both, and a "Scénario" value sitting next to "Automatisé" is the kind of
 * drift the classification exists to prevent. The type carries the company's own
 * words; this dimension carries the doctrine's.
 */
const EmailTrigger = Object.freeze({
  // A send the team decided on, this once.
  AD_HOC: 'adhoc',
  // A send a rule decides, every time.
  AUTOMATED: 'automated',
});

const EmailTriggerValues = Object.freeze(Object.values(EmailTrigger));

// The doctrine's words for each value, for the server's readers: the AI features
// read them through the governance context. The editor keeps its own copy in its
// locales (`email-metadata-trigger-*`); the two say the same thing.
const EmailTriggerDefinitions = Object.freeze({
  fr: Object.freeze({
    [EmailTrigger.AD_HOC]: {
      label: 'Ad hoc',
      description: "Un envoi décidé par l'équipe, pour cette fois.",
    },
    [EmailTrigger.AUTOMATED]: {
      label: 'Automatisé',
      description: 'Un envoi décidé par une règle, à chaque fois.',
    },
  }),
  en: Object.freeze({
    [EmailTrigger.AD_HOC]: {
      label: 'One Shot',
      description: 'A send the team decided on, this once.',
    },
    [EmailTrigger.AUTOMATED]: {
      label: 'Automated',
      description: 'A send a rule decides, every time.',
    },
  }),
});

module.exports = { EmailTrigger, EmailTriggerValues, EmailTriggerDefinitions };
