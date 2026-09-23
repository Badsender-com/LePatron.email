'use strict';

/**
 * Canonical email types — the Badsender classification doctrine.
 *
 * Six types, each defined by ONE question: what does this email bring to the
 * person receiving it? See the doctrine for the full definitions, the boundary
 * cases and the rules each type carries.
 *
 * Each company names and defines its typologies in its own words — that is the
 * point of the taxonomy. `canonicalType` is the optional bridge: a company's
 * "Infolettre", with its own definition, maps to `editorial`, so the right AI
 * expertise loads whatever the client called it. A company's definition may
 * RESTRICT or PRECISE the Badsender one; it may not contradict it.
 *
 * What this list is NOT, and why the previous one was wrong:
 *   - `newsletter` was a free tag, not a type. A newsletter is `editorial` when
 *     it carries content worth reading, `promotional` when its main block sells.
 *   - `marketing-automation` was a *trigger* dressed up as a type. How a send is
 *     decided is the second, INDEPENDENT dimension — see constant/email-trigger.js.
 *     A password reset is transactional × automated; a birthday email is
 *     promotional × automated. Folding the two into one list forced a choice
 *     between them.
 *
 * KEEP IN SYNC with `EMAIL_TYPES` in packages/ui/helpers/email-types.js, where an
 * expertise is filtered by `appliesToEmailTypes`. Enforced by
 * tests/ui/helpers/email-type-vocabulary.test.js.
 *
 * Deliberately NOT enforced as a Mongoose enum on the taxonomy schema: this list
 * will move, and the skills side already stores these values raw and falls back to
 * the raw string for unknown ones. Constraining the database would turn a
 * vocabulary change into a migration.
 */
const EmailTypeCanonical = Object.freeze({
  // Content worth reading in itself, whatever it might sell.
  EDITORIAL: 'editorial',
  // A reason to buy, to subscribe, or to prefer the brand.
  PROMOTIONAL: 'promotional',
  // How the product or the service works, so the customer uses it better.
  SERVICE: 'service',
  // A change on the person's account, order or rights, which they did not ask for.
  NOTIFICATION: 'notification',
  // What the person just asked for, and is waiting on.
  TRANSACTIONAL: 'transactional',
  // A fact that binds the company, identical for every recipient concerned.
  INSTITUTIONAL: 'institutional',
});

const EmailTypeCanonicalValues = Object.freeze(
  Object.values(EmailTypeCanonical)
);

module.exports = { EmailTypeCanonical, EmailTypeCanonicalValues };
