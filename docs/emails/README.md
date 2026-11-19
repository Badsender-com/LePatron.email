# Emails envoyés par la plateforme

Inventaire des emails que LePatron envoie de lui-même (compte, mot de passe, double authentification). Les emails que les utilisateurs produisent dans l'éditeur ne sont pas concernés, sauf l'envoi de test, listé en bas.

État relevé le 2026-11-19 dans le code de `develop`. Cet inventaire décrit l'existant, y compris ses défauts : le chantier d'alignement (design system, accessibilité, multilingue) part de lui.

## Où ça se passe

| Rôle                | Fichier                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport SMTP      | [mail.service.js](../../packages/server/mailing/mail.service.js) (`mail.send`, nodemailer)                                                       |
| Gabarit HTML unique | [reset-password.html](../../packages/server/email-templates/reset-password.html) (blueimp-tmpl, 432 lignes)                                      |
| Textes et rendu     | [email-template.js](../../packages/server/email-templates/email-template.js) (`renderEmail`, `PASSWORD_TEXTS`)                                   |
| Emails du compte    | [user.schema.js](../../packages/server/user/user.schema.js) (`resetPassword`, `setPassword`)                                                     |
| Emails 2FA          | [two-factor.emails.js](../../packages/server/two-factor/two-factor.emails.js) et [email-code.js](../../packages/server/two-factor/email-code.js) |
| Expéditeur, préfixe | `config.emailOptions` dans [node.config.js](../../packages/server/node.config.js) (`from`, `passwordSubjectPrefix`)                              |

Tous les emails de la plateforme passent par le même gabarit : seuls le titre, le texte et le libellé du bouton changent, en français ou en anglais (`user.lang`, anglais par défaut).

## Les emails

| #   | Email                                    | Déclencheur                                                                                                                          | Destinataire           | Sujet (après le préfixe `Email builder LePatron – `)    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------- |
| 1   | Initialisation du mot de passe           | Un admin réinitialise le compte : `adminResetPassword` ([user.controller.js:358](../../packages/server/user/user.controller.js))     | Le membre              | `Password reset` (anglais fixe)                         |
| 2   | Mot de passe oublié                      | Le membre demande un lien : `forgotPassword` ([user.controller.js:395](../../packages/server/user/user.controller.js))               | Le membre              | `Password reset` (anglais fixe)                         |
| 3   | Mot de passe réinitialisé (confirmation) | Le membre a saisi son nouveau mot de passe : `setPassword` ([user.controller.js:443](../../packages/server/user/user.controller.js)) | Le membre              | `password reset` (anglais fixe)                         |
| 4   | Code de vérification                     | Connexion avec la méthode « code par email » : `sendEmailCode`                                                                       | Le membre              | `Double authentification` / `Two-factor authentication` |
| 5   | Double authentification activée          | Fin de la configuration 2FA : [two-factor.controller.js:293](../../packages/server/two-factor/two-factor.controller.js)              | Le membre              | idem                                                    |
| 6   | Double authentification réinitialisée    | Un admin réinitialise la 2FA : [two-factor.controller.js:348](../../packages/server/two-factor/two-factor.controller.js)             | Le membre              | idem                                                    |
| 7   | Adresse du compte modifiée               | Changement d'adresse qui réinitialise la méthode par email : [reset.js:73](../../packages/server/two-factor/reset.js)                | L'**ancienne** adresse | idem                                                    |
| 8   | Code de secours utilisé                  | Connexion par code de secours : [two-factor.controller.js:201](../../packages/server/two-factor/two-factor.controller.js)            | Le membre              | idem                                                    |
| 9   | Nouvel appareil de confiance             | Appareil mémorisé 30 jours : [two-factor.controller.js:119](../../packages/server/two-factor/two-factor.controller.js)               | Le membre              | idem                                                    |

Précisions :

- Il n'y a pas d'email de bienvenue à la création d'un compte : l'« initialisation » (n° 1) part de la réinitialisation par un admin. À confirmer côté produit si c'est voulu.
- Un membre dont le groupe utilise le SSO ne reçoit pas les emails 1 et 2 (pas de mot de passe).
- Les emails 5 à 9 n'échouent jamais la requête qui les envoie : une erreur d'envoi est journalisée. Les emails 1 et 3 échouent la requête.
- Les liens de 1 et 2 portent un jeton valable une semaine ; celui du code (4) vit 10 minutes, 3 codes par étape, 10 par heure.

### Hors gabarit

| Email         | Déclencheur                                                                                                                       | Contenu                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Envoi de test | L'éditeur envoie le mailing à des adresses ([send-test-mail.service.js](../../packages/server/mailing/send-test-mail.service.js)) | Le HTML du mailing en cours d'édition. Sujet : celui du mailing, à défaut son nom. Pas de texte brut. |

Les fournisseurs ESP ([esp/](../../packages/server/esp/)) exportent vers des services tiers, ils n'envoient pas d'email.

## Constats du premier relevé

À valider en rendu réel avant de les corriger.

### Design system

- Le gabarit porte l'identité **Badsender** (logos hébergés sur badsender.com, bouton noir `#141414` en pilule, pied de page marketing), pas celle de l'application : primaire `#093040`, accent `#00ACDC`, couleurs de marque par groupe prévues par [01-tokens.md](../design-system/01-tokens.md).
- Polices Inter chargées depuis fonts.gstatic.com, avec trois familles factices (`Inter_bold`, `Inter_black`) au lieu des graisses.
- Tous les styles sont écrits en dur dans le gabarit, sans jeu de jetons.

### Accessibilité et intégration

- `lang="en"` et `xml:lang="en"` figés dans `<html>`, même quand le contenu est en français.
- `<title>` constant (« Le Patron ») : il devrait porter le titre de l'email.
- Le bouton est un `<a>` dans un `<p>` dans une cellule de tableau : la zone cliquable se limite au texte, pas à la pilule.
- Le `<h1>` n'existe que pour le type `admin` : l'email « mot de passe oublié » (2) n'a aucun titre.
- Préheader vide.
- Liens du pied de page : l'icône « Facebook » pointe vers GitHub (`alt` faux), l'icône « Twitter » vers un compte X.
- Long pied de page (RGPD, « détruisez ce message », mentions) identique pour un code à 6 chiffres : bruit pour un lecteur d'écran.
- Pas de gestion du mode sombre.
- Texte brut (`text`) : anglais fixe pour 1 et 3, et sans le titre.

### Multilingue

- Deux langues seulement (fr, en) ; toute autre langue tombe en anglais sans le dire.
- Sujets 1, 2 et 3 en anglais quoi que la langue du membre ; le préfixe `Email builder LePatron` n'est traduit nulle part.
- Les textes vivent dans trois fichiers (`email-template.js`, `two-factor.emails.js`, `email-code.js`) et pas dans `locales/`, donc hors du circuit de traduction de l'application.
- Le code de vérification est dans le titre (`Votre code de vérification : 123456`) et le bouton « SE CONNECTER » ne sert à rien dans cet email.

### Tests

- Aucun test sur `renderEmail` ni sur `two-factor.emails.js` ; seuls les tests de `user.schema` touchent aux emails 1 à 3.
