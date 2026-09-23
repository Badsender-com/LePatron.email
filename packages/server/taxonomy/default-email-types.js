'use strict';

const { EmailTypeCanonical } = require('../constant/email-type-canonical.js');

/**
 * The six Badsender email types, seeded into every company's taxonomy.
 *
 * Why seed at all, when the taxonomy exists precisely so each company uses its own
 * words: an empty selector asks an admin to invent a classification from scratch,
 * and the doctrine already provides the one the expertise is written against. The
 * items are ordinary taxonomy items — renameable, re-describable, deactivatable.
 * A company's own definition may RESTRICT or PRECISE the Badsender one ("here,
 * Service excludes satisfaction surveys"); it may not contradict it ("here,
 * Service allows discount codes"), or there is no shared base left to hang the
 * generic expertise on.
 *
 * Each description carries the doctrine's short definition and its boundary test —
 * the question that settles a case between two neighbouring types. Not the rules
 * the type carries (consent, mandatory mentions, forbidden blocks): those belong to
 * the expertise, and a company editing this field must not have to preserve them.
 *
 * Labels and descriptions are per-language because a TaxonomyItem stores ONE
 * string: the seed picks the language of whoever creates the company, and the
 * admin renames from there.
 */
const DEFAULT_EMAIL_TYPES = Object.freeze([
  {
    canonicalType: EmailTypeCanonical.EDITORIAL,
    order: 1,
    fr: {
      label: 'Éditorial',
      description:
        "Un contenu qui a de la valeur en lui-même pour le lecteur, indépendamment de ce qu'il pourrait faire vendre. Test : le lecteur y trouverait-il de la valeur même s'il n'avait jamais l'intention d'acheter quoi que ce soit ?",
    },
    en: {
      label: 'Editorial',
      description:
        'Content that is worth reading in itself, whatever it might sell. Test: would the reader get something out of this email even if they never intended to buy anything?',
    },
  },
  {
    canonicalType: EmailTypeCanonical.PROMOTIONAL,
    order: 2,
    fr: {
      label: 'Promotionnel',
      description:
        "Un email qui donne une raison d'acheter, de souscrire ou de préférer la marque. Test : le but principal de l'email est-il de faire acheter ou de faire aimer la marque ?",
    },
    en: {
      label: 'Promotional',
      description:
        'An email that gives a reason to buy, to subscribe, or to prefer the brand. Test: is the main purpose of this email to sell, or to make the brand liked?',
    },
  },
  {
    canonicalType: EmailTypeCanonical.SERVICE,
    order: 3,
    fr: {
      label: 'Serviciel',
      description:
        "Un email qui explique comment fonctionne le produit ou le service, pour aider le client ou le prospect à mieux s'en servir. Test : l'email explique-t-il le fonctionnement, l'usage ou les droits attachés à ce que la personne a, ou s'apprête à avoir ?",
    },
    en: {
      label: 'Service',
      description:
        'An email that explains how the product or the service works, so the customer or prospect gets more out of it. Test: does the email explain how something works, how it is used, or what rights come with it?',
    },
  },
  {
    canonicalType: EmailTypeCanonical.NOTIFICATION,
    order: 4,
    fr: {
      label: 'Suivi',
      description:
        "Un email qui informe la personne d'un changement sur son compte, sa commande ou ses droits, sans qu'elle ait demandé cet email. Test : le contenu existerait-il sans la donnée de cette personne ? Si non, c'est du Suivi.",
    },
    en: {
      label: 'Notification',
      description:
        "An email telling the person about a change to their account, their order or their rights, which they never asked to receive. Test: would this content exist at all without this person's data? If not, it belongs here.",
    },
  },
  {
    canonicalType: EmailTypeCanonical.TRANSACTIONAL,
    order: 5,
    fr: {
      label: 'Transactionnel',
      description:
        "Un email qui livre ce que la personne vient de demander, et dont elle attend l'arrivée. Trois questions, trois oui : a-t-elle demandé cet email-là, et pas seulement « à recevoir des emails » ? S'en plaindrait-elle s'il n'arrivait pas ? Peut-il partir sans lien de désinscription ?",
    },
    en: {
      label: 'Transactional',
      description:
        'An email that delivers what the person just asked for, and is waiting on. Three questions, three yes: did they ask for THIS email, not merely to receive emails? Would they complain if it never arrived? Can it be sent with no unsubscribe link?',
    },
  },
  {
    canonicalType: EmailTypeCanonical.INSTITUTIONAL,
    order: 6,
    fr: {
      label: 'Institutionnel',
      description:
        "Un email qui informe d'un fait engageant l'entreprise, identique pour tous les destinataires concernés. Test : le contenu serait-il rigoureusement identique pour tous les destinataires concernés, au point de pouvoir être publié tel quel sur une page publique ?",
    },
    en: {
      label: 'Institutional',
      description:
        'An email about a fact that binds the company, identical for every recipient concerned. Test: would the content be rigorously the same for everyone concerned — so much so that it could be published as is on a public page?',
    },
  },
]);

// A TaxonomyItem stores one label, so the seed has to pick a language. `en` is the
// fallback because that is `User.lang`'s own default.
const DEFAULT_SEED_LANG = 'en';
const SEED_LANGS = Object.freeze(['fr', 'en']);

/**
 * The taxonomy items to create for a company, in the given language.
 *
 * Pure: takes no database, returns plain objects. The caller adds `_company` and
 * `type`.
 *
 * @param {string} [lang] `fr` or `en`; anything else falls back to `en`
 * @returns {Array<{label: string, description: string, canonicalType: string, order: number}>}
 */
function buildDefaultEmailTypes(lang) {
  const locale = SEED_LANGS.includes(lang) ? lang : DEFAULT_SEED_LANG;

  return DEFAULT_EMAIL_TYPES.map((item) => ({
    label: item[locale].label,
    description: item[locale].description,
    canonicalType: item.canonicalType,
    order: item.order,
  }));
}

module.exports = {
  DEFAULT_EMAIL_TYPES,
  DEFAULT_SEED_LANG,
  SEED_LANGS,
  buildDefaultEmailTypes,
};
