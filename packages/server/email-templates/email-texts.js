'use strict';

// The words of the emails the application sends about an account: what every
// email says around its own text, and the texts of the three about the
// password, in French and in English. The ones about two-factor authentication
// are with their senders (two-factor/). The vocabulary and the voice are those
// of the application and its brandbook (docs/emails/).

// What every email says around its own text.
// In French a colon takes a no-break space before it, so a line never starts
// with one: the character U+00A0, written with an escape below, which the
// escaping of the template leaves alone.
const COMMON_TEXTS = {
  fr: {
    fallback:
      'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur\u00a0:',
    sent:
      'LePatron, la plateforme de gouvernance email et CRM de Badsender, vous envoie cet email automatiquement.',
    data: 'Pour vos données personnelles, consultez notre',
    privacy: 'politique de confidentialité',
    or: 'ou écrivez à',
    colon: '\u00a0: ',
  },
  en: {
    fallback: 'If the button does not work, copy this link into your browser:',
    sent:
      'LePatron, Badsender’s email and CRM governance platform, sends you this email automatically.',
    data: 'For your personal data, read our',
    privacy: 'privacy policy',
    or: 'or write to',
    colon: ': ',
  },
};

// A link in a password email lives a week (`resetPassword` of the user
// schema): the texts below say so.
const PASSWORD_TEXTS = {
  // The first password of an account an administrator created: the one email
  // that says why LePatron is worth the trouble: three promises of the
  // brandbook, in the vocabulary of the application (GLOSSARY.md: what a
  // company designs is an email) and its voice (formal vous, short sentences,
  // facts).
  welcome: {
    fr: {
      subject: 'Bienvenue',
      title: 'Bienvenue sur LePatron',
      preheader: 'Choisissez votre mot de passe et entrez dans LePatron.',
      desc:
        'Un administrateur a créé votre compte LePatron, la plateforme de gouvernance email et CRM de votre équipe. Choisissez votre mot de passe pour y entrer. Ce lien est valable 7 jours.',
      benefits: {
        title: 'Ce qui vous attend',
        items: [
          {
            icon: 'blocks',
            title: 'Pas de feuille blanche.',
            text:
              'Vous composez vos emails avec des blocs conçus pour votre marque, déjà conformes à vos règles.',
          },
          {
            icon: 'badge-check',
            title: 'Le cadre, sans y penser.',
            text:
              'Charte, règles de rédaction, contrôle qualité\u00a0: tout est vérifié avant l’envoi.',
          },
          {
            icon: 'languages',
            title: 'Des déclinaisons sans copier-coller.',
            text:
              'Langues, marques, marchés\u00a0: adaptez un email sans refaire la mise en page.',
          },
        ],
      },
      button: 'Choisir mon mot de passe',
    },
    en: {
      subject: 'Welcome',
      title: 'Welcome to LePatron',
      preheader: 'Choose your password and step into LePatron.',
      desc:
        'An administrator created your LePatron account, your team’s email and CRM governance platform. Choose your password to get in. This link is valid for 7 days.',
      benefits: {
        title: 'What awaits you',
        items: [
          {
            icon: 'blocks',
            title: 'No blank page.',
            text:
              'You build emails from blocks designed for your brand, already compliant with your rules.',
          },
          {
            icon: 'badge-check',
            title: 'The framework, effortlessly.',
            text:
              'Brand guidelines, writing rules, quality control: everything is checked before sending.',
          },
          {
            icon: 'languages',
            title: 'Variants without copy-paste.',
            text:
              'Languages, brands, markets: adapt an email without redoing the layout.',
          },
        ],
      },
      button: 'Choose my password',
    },
  },
  // A new password, an administrator's doing.
  reset: {
    fr: {
      subject: 'Nouveau mot de passe',
      title: 'Choisissez un nouveau mot de passe',
      preheader: 'Ce lien est valable 7 jours.',
      desc:
        'Un administrateur a réinitialisé votre mot de passe. Choisissez-en un nouveau pour vous connecter. Ce lien est valable 7 jours.',
      button: 'Choisir un nouveau mot de passe',
    },
    en: {
      subject: 'New password',
      title: 'Choose a new password',
      preheader: 'This link is valid for 7 days.',
      desc:
        'An administrator reset your password. Choose a new one to sign in. This link is valid for 7 days.',
      button: 'Choose a new password',
    },
  },
  // A new password, asked for by the person.
  forgot: {
    fr: {
      subject: 'Nouveau mot de passe',
      title: 'Choisissez un nouveau mot de passe',
      preheader: 'Ce lien est valable 7 jours.',
      desc:
        'Vous avez demandé un nouveau mot de passe. Choisissez-le avec le bouton ci-dessous. Ce lien est valable 7 jours. Si ce n’est pas vous, ignorez cet email\u00a0: votre mot de passe actuel reste valable.',
      button: 'Choisir un nouveau mot de passe',
    },
    en: {
      subject: 'New password',
      title: 'Choose a new password',
      preheader: 'This link is valid for 7 days.',
      desc:
        'You asked for a new password. Choose it with the button below. This link is valid for 7 days. If this was not you, ignore this email: your current password still works.',
      button: 'Choose a new password',
    },
  },
  // The password is set: a first one, or a new one. The mail cannot tell which
  // (the link does not remember), so it says neither. A company admin or a
  // tech admin may have sent the link: the text names neither.
  confirmation: {
    fr: {
      subject: 'Mot de passe enregistré',
      title: 'Votre mot de passe est enregistré',
      preheader: 'Vous pouvez vous connecter avec votre mot de passe.',
      desc:
        'Vous avez choisi votre mot de passe. Si ce n’est pas vous, prévenez un administrateur de votre entreprise.',
      button: 'Ouvrir LePatron',
    },
    en: {
      subject: 'Password saved',
      title: 'Your password is saved',
      preheader: 'You can sign in with your password.',
      desc:
        'You chose your password. If this was not you, tell an administrator of your company.',
      button: 'Open LePatron',
    },
  },
};

module.exports = { COMMON_TEXTS, PASSWORD_TEXTS };
