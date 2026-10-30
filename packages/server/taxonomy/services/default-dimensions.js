'use strict';

const { StandardDimensions } = require('../../constant/taxonomy-type.js');
const { pickSeedLang } = require('./default-email-types.js');

/**
 * The two standard dimensions (ADR-0014), seeded for every company.
 *
 * Their name is the doctrine's and fixed; their label, description, order and
 * precedence are the company's from the first edit on. The descriptions are read
 * by an admin and by the AI features, so they say what the dimension decides
 * about an email, never how the application implements it.
 */
const STANDARD_DIMENSIONS = Object.freeze([
  {
    name: StandardDimensions.EMAIL_TYPE,
    order: 10,
    // The most specific statement about one email is the kind of email it is,
    // so it is given the last word on a token by default. Spread by tens so a
    // company can slot its own dimensions below it.
    precedence: 100,
    fr: {
      label: 'Typologie',
      description:
        "Ce que l'email apporte à la personne qui le reçoit : une infolettre, une confirmation de commande, une promotion. Décide du ton, du niveau d'insistance et des obligations légales.",
    },
    en: {
      label: 'Email type',
      description:
        'What the email brings to the person receiving it: a newsletter, an order confirmation, a promotion. Decides the tone, how insistent it may be and the legal obligations.',
    },
  },
  {
    name: StandardDimensions.TRIGGER,
    order: 20,
    precedence: 0,
    fr: {
      label: 'Déclenchement',
      description:
        "Si quelqu'un a décidé de cet envoi-là (ponctuel) ou si une règle le décide à chaque fois (automatisé). Décide de ce que l'email peut supposer du moment où il est lu.",
    },
    en: {
      label: 'Trigger',
      description:
        'Whether someone decided this particular send (ad hoc) or a rule decides it every time (automated). Decides what the email may assume about the moment it is read.',
    },
  },
]);

/**
 * The standard dimensions in one language, ready to insert. A dimension stores
 * one label, like a value, so the seed writes the admin's language.
 *
 * @param {string} [lang]
 * @returns {Object[]}
 */
function buildStandardDimensions(lang) {
  const locale = pickSeedLang(lang);

  return STANDARD_DIMENSIONS.map((dimension) => ({
    name: dimension.name,
    label: dimension[locale].label,
    description: dimension[locale].description,
    order: dimension.order,
    precedence: dimension.precedence,
    standard: true,
  }));
}

module.exports = { STANDARD_DIMENSIONS, buildStandardDimensions };
