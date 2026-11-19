# Emails envoyés par la plateforme

Inventaire des emails que LePatron envoie de lui-même (compte, mot de passe, double authentification). Les emails que les utilisateurs produisent dans l'éditeur ne sont pas concernés, sauf l'envoi de test, listé en bas.

État après la refonte du 2026-11-19. L'état d'avant, ses défauts relevés et la grille d'accessibilité appliquée sont dans [audit-accessibilite.md](./audit-accessibilite.md).

## Où ça se passe

| Rôle                | Fichier                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport SMTP      | [mail.service.js](../../packages/server/mailing/mail.service.js) (`mail.send`, nodemailer)                                                                                                                                           |
| Gabarit HTML unique | [account-email.html](../../packages/server/email-templates/account-email.html) (blueimp-tmpl), sur le modèle de la carte de connexion de l'application                                                                               |
| Images              | [assets/](../../packages/server/email-templates/assets/) : logo et icônes, joints à chaque email (`cid:`), construits par [build-email-images.js](../../scripts/build-email-images.js) depuis le logo et les icônes de l'application |
| Textes et rendu     | [email-template.js](../../packages/server/email-templates/email-template.js) (`composeEmail`, `resolveLanguage`, textes des emails de mot de passe)                                                                                  |
| Emails du compte    | [user.schema.js](../../packages/server/user/user.schema.js) (`resetPassword`, `setPassword`)                                                                                                                                         |
| Emails 2FA          | [two-factor.emails.js](../../packages/server/two-factor/two-factor.emails.js) et [email-code.js](../../packages/server/two-factor/email-code.js)                                                                                     |
| Expéditeur, préfixe | `config.emailOptions` dans [node.config.js](../../packages/server/node.config.js) (`from`, `passwordSubjectPrefix`)                                                                                                                  |
| Tests               | [platform-emails.test.js](../../tests/server/emails/platform-emails.test.js) : le contrat des 10 envois, en français et en anglais                                                                                                   |

Tous les emails passent par le même gabarit. Chacun a, dans les deux langues (`user.lang`, anglais par défaut), un sujet, un titre, un préheader, un texte et, sauf le code, un bouton. `composeEmail` en tire le sujet, le HTML et la version texte.

## Les emails

Sujet : après le préfixe `Email builder LePatron – `.

| #   | Email                                 | Déclencheur                                                                                                                                                                      | Destinataire           | Sujet fr / en                                           |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------- |
| 1   | Bienvenue (première initialisation)   | Un admin envoie le lien à un compte jamais initialisé (ni mot de passe ni lien) : `adminResetPassword` ([user.controller.js:358](../../packages/server/user/user.controller.js)) | Le membre              | `Bienvenue sur LePatron` / `Welcome to LePatron`        |
| 2   | Nouveau mot de passe (admin)          | Un admin réinitialise un compte déjà initialisé, ou renvoie le lien                                                                                                              | Le membre              | `Nouveau mot de passe` / `New password`                 |
| 3   | Mot de passe oublié                   | Le membre demande un lien : `forgotPassword` ([user.controller.js:395](../../packages/server/user/user.controller.js))                                                           | Le membre              | `Nouveau mot de passe` / `New password`                 |
| 4   | Mot de passe enregistré               | Le membre a choisi son mot de passe : `setPassword` ([user.controller.js:443](../../packages/server/user/user.controller.js))                                                    | Le membre              | `Mot de passe enregistré` / `Password saved`            |
| 5   | Code de vérification                  | Connexion avec la méthode « code par email » : `sendEmailCode`                                                                                                                   | Le membre              | `Double authentification` / `Two-factor authentication` |
| 6   | Double authentification activée       | Fin de la configuration 2FA : [two-factor.controller.js:293](../../packages/server/two-factor/two-factor.controller.js)                                                          | Le membre              | idem                                                    |
| 7   | Double authentification réinitialisée | Un admin réinitialise la 2FA : [two-factor.controller.js:348](../../packages/server/two-factor/two-factor.controller.js)                                                         | Le membre              | idem                                                    |
| 8   | Adresse du compte modifiée            | Changement d'adresse qui réinitialise la méthode par email : [reset.js:73](../../packages/server/two-factor/reset.js)                                                            | L'**ancienne** adresse | idem                                                    |
| 9   | Code de secours utilisé               | Connexion par code de secours : [two-factor.controller.js:201](../../packages/server/two-factor/two-factor.controller.js)                                                        | Le membre              | idem                                                    |
| 10  | Nouvel appareil de confiance          | Appareil mémorisé 30 jours : [two-factor.controller.js:119](../../packages/server/two-factor/two-factor.controller.js)                                                           | Le membre              | idem                                                    |

Précisions :

- Les emails 1 à 3 sont les deux textes d'un même envoi, `resetPassword` : l'état du compte, lu **avant** que l'envoi ne l'efface, choisit la bienvenue (ni mot de passe ni lien : statut `to-be-initialized`) ou le nouveau mot de passe. Un lien de bienvenue renvoyé avant d'avoir servi est donc un « nouveau mot de passe ». Un compte désactivé, qui perd les deux, est de nouveau accueilli à sa réactivation.
- L'email 4 ne dit pas s'il s'agit d'un premier mot de passe ou d'un nouveau : le lien ne s'en souvient pas.
- Un membre dont le groupe utilise le SSO ne reçoit pas les emails 1 à 3 (pas de mot de passe).
- Les emails 5 à 10 n'échouent jamais la requête qui les envoie : une erreur d'envoi est journalisée. Les emails 1 à 4 échouent la requête.
- Les liens de 1 à 3 valent une semaine (`tokenExpire`, dit « 7 jours » dans les textes) ; le code (5) vit 10 minutes, 3 codes par étape, 10 par heure.
- Une langue autre que fr et en (`user.lang` est un texte libre) est écrite en anglais, et le journal le signale. `FR` et `fr-FR` sont lus comme `fr`.

### Hors gabarit

| Email         | Déclencheur                                                                                                                       | Contenu                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Envoi de test | L'éditeur envoie le mailing à des adresses ([send-test-mail.service.js](../../packages/server/mailing/send-test-mail.service.js)) | Le HTML du mailing en cours d'édition. Sujet : celui du mailing, à défaut son nom. Pas de texte brut. |

Les fournisseurs ESP ([esp/](../../packages/server/esp/)) exportent vers des services tiers, ils n'envoient pas d'email.
