'use strict';

/**
 * Canonical email types, used to map a company's own typology onto the vocabulary
 * the AI skills understand.
 *
 * Each company names and defines its typologies in its own words — that is the
 * point of the taxonomy. `canonicalType` is the optional bridge: a company's
 * "Infolettre", with its own definition, maps to `newsletter`, so the right AI
 * expertise loads whatever the client called it.
 *
 * KEEP IN SYNC with `EMAIL_TYPES` in packages/ui/helpers/email-types.js (branch
 * feat/AI-skills-v1, PR #1075), where an expertise is filtered by
 * `appliesToEmailTypes`.
 *
 * Deliberately NOT enforced as a Mongoose enum on the taxonomy schema: this list
 * was not designed up front and will move, and the skills side already stores
 * these values raw and falls back to the raw string for unknown ones. Constraining
 * the database would turn a vocabulary change into a migration.
 */
const EmailTypeCanonical = Object.freeze({
  PROMO: 'promo',
  NEWSLETTER: 'newsletter',
  TRANSACTIONAL: 'transactional',
  // Scenario-driven sends — abandoned cart, birthday, welcome sequence, lifecycle
  // nurturing. Neither promotional nor transactional in the AI's sense: the intent
  // is commercial, but the send is fired by the contact's own behaviour rather
  // than by a campaign calendar.
  //
  // The stored value is the vocabulary the AI receives, so it says what the user
  // picked: an expertise tagged `marketing-automation` is the one that should load
  // for an email the user filed under "Marketing Automation".
  MARKETING_AUTOMATION: 'marketing-automation',
});

const EmailTypeCanonicalValues = Object.freeze(
  Object.values(EmailTypeCanonical)
);

module.exports = { EmailTypeCanonical, EmailTypeCanonicalValues };
