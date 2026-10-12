'use strict';

/**
 * The texts of the public share page (share-page.controller.js), in the two
 * languages a link can carry: notices for a link that does not open, and the
 * bar above an email that does.
 */
module.exports = {
  fr: {
    unknown: {
      title: 'Lien introuvable',
      message:
        "Ce lien d'aperçu n'existe pas ou a été désactivé. Demandez un nouveau lien à la personne qui vous l'a envoyé.",
    },
    expired: {
      title: 'Lien expiré',
      message:
        "Ce lien d'aperçu a expiré. Demandez un nouveau lien à la personne qui vous l'a envoyé.",
    },
    empty: {
      title: 'Aperçu indisponible',
      message:
        "Cet email n'a pas encore d'aperçu : il doit d'abord être enregistré dans l'éditeur.",
    },
    busy: {
      title: 'Trop de consultations',
      message: 'Ce lien a été ouvert trop souvent. Réessayez dans un moment.',
    },
    error: {
      title: 'Aperçu indisponible',
      message: "L'aperçu n'a pas pu être affiché. Réessayez dans un moment.",
    },
    meta: (date) =>
      `Aperçu de la dernière version enregistrée · lien valable jusqu'au ${date} · les liens de l'email s'ouvrent dans un nouvel onglet`,
    subject: 'Objet',
    preheader: 'Préheader',
  },
  en: {
    unknown: {
      title: 'Link not found',
      message:
        'This preview link does not exist or was turned off. Ask whoever sent it for a new one.',
    },
    expired: {
      title: 'Link expired',
      message:
        'This preview link has expired. Ask whoever sent it for a new one.',
    },
    empty: {
      title: 'Preview unavailable',
      message:
        'This email has no preview yet: it must first be saved in the editor.',
    },
    busy: {
      title: 'Too many views',
      message: 'This link was opened too often. Try again in a moment.',
    },
    error: {
      title: 'Preview unavailable',
      message: 'The preview could not be shown. Try again in a moment.',
    },
    meta: (date) =>
      `Preview of the last saved version · link valid until ${date} · links in the email open in a new tab`,
    subject: 'Subject',
    preheader: 'Preheader',
  },
};
