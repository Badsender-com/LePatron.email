# Audit des emails de la plateforme : accessibilité, intégration, design system, multilingue

Audit du 2026-11-19, grille « Diagnostic accessibilité des emails » de Badsender (60 critères, Notion, mise à jour du 2026-10-07) et charte d'intégration (Notion, mise à jour du 2026-11-03). Positions arrêtées du 7 octobre 2026 appliquées : ARIA selon la grille, VML réservé à l'habillage, corps 14 px desktop et 16 px mobile.

Inventaire des emails : [README.md](./README.md).

## Périmètre et limites

- **Audité** : le HTML réellement produit par le code (`renderEmail` et les envois, `mail.send` intercepté), pour les 9 emails en français et en anglais, soit 18 fichiers.
- **Non testé** : rendu dans un client réel (Gmail, Outlook, Apple Mail), lecteur d'écran (NVDA, VoiceOver), mode sombre, mobile sur téléphone. Le navigateur intégré n'a affiché les fichiers qu'en instantané statique, sans capture. Tout ce qui touche au rendu est donc **À analyser**, pas conforme.
- **Pas une conformité légale** : aucun référentiel officiel ne couvre l'email. Ce document mesure un rapprochement RGAA / EAA.
- **Responsable** : il s'agit d'un seul gabarit et de textes dans le code, donc quasi tout est « Équipe technique ». Les textes relèvent de « Rédacteurs ».

Les 18 rendus et les sujets sont régénérables avec le script de l'audit (voir « Reproduire »).

## Constats transverses

Les 9 emails partagent un seul gabarit : une correction y vaut pour tous.

| #   | Constat                                                                                                                                                              | Preuve                                                              | Importance |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| T1  | La langue déclarée est toujours `en`, même pour un contenu français. Pas de `lang` sur une `div` englobante.                                                         | `<html … xml:lang="en" … lang="en">` dans les 9 fichiers `.fr.html` | Critique   |
| T2  | Pas de `div role="article"` englobante.                                                                                                                              | 0 occurrence                                                        | Moyenne    |
| T3  | `<title>` fixe « Le Patron » dans tous les emails.                                                                                                                   | 18 fichiers sur 18                                                  | Moyenne    |
| T4  | Le `<h1>` n'existe que si `type === 'admin'` : l'email « mot de passe oublié » n'a **aucun titre**.                                                                  | `resetForgot.{fr,en}.html` : 0 `<h1>`                               | Critique   |
| T5  | Le bouton n'est pas entièrement cliquable : le `<a>` est inline dans un `<p>` dans une cellule à padding 20/40 px. Seul le texte réagit au clic.                     | gabarit, lignes 334-342                                             | Critique   |
| T6  | Interligne sous 150 % : corps 18/25 (139 %), pied 14/20 (143 %), titre 50/50 (100 %, un titre long sur 2 lignes se touche).                                          | `line-height` du gabarit                                            | Moyenne    |
| T7  | Les sujets de 3 emails sur 9 sont en anglais pour un membre francophone, avec une casse incohérente (`Password reset` / `password reset`).                           | `resetAdmin.fr.json`, `resetForgot.fr.json`, `resetSuccess.fr.json` | Moyenne    |
| T8  | Le préfixe `Email builder LePatron` du sujet n'est pas traduit et ne s'appelle pas LePatron seul comme le logo.                                                      | `config.emailOptions.passwordSubjectPrefix`                         | Faible     |
| T9  | Libellé du bouton en majuscules saisies dans la source (« SE CONNECTER »), pas en `text-transform` : les lecteurs d'écran peuvent épeler, la casse ne se change pas. | `PASSWORD_TEXTS`, `SIGN_IN`, `TEXTS`                                | Moyenne    |
| T10 | Libellés vagues et répétés : « SE CONNECTER » ouvre la même page quel que soit l'email, y compris pour un code (4) ou un avertissement (6, 7, 8, 9).                 | `two-factor.emails.js`                                              | Critique   |
| T11 | Pied de page identique pour des emails de sécurité : RGPD, « détruisez ce message », mentions, 3 icônes sociales. Bruit, et poids inutile.                           | gabarit, lignes 360-420                                             | Moyenne    |
| T12 | Icône `alt="Facebook"` qui pointe vers GitHub ; `alt="Twitter"` vers un compte X. Texte alternatif faux.                                                             | `href="https://github.com/Badsender-com/LePatron.email"`            | Critique   |
| T13 | Images décoratives sans `alt=""` ni `role="presentation"` (3 icônes sociales et logo Badsender redondants avec le texte). Pas de `title` sur les images (conforme).  | balises `<img>`                                                     | Moyenne    |
| T14 | Aucune règle `prefers-color-scheme` ; logo noir et filet `#DDDCDC` à vérifier en mode sombre.                                                                        | 0 occurrence                                                        | Faible     |
| T15 | Version texte brut : anglais fixe pour 1, 2 et 3, sans lien « version en ligne », pas de titre. Pour 4 à 9, titre + description + URL (acceptable).                  | `*.json` des rendus                                                 | Faible     |
| T16 | Code mort : feuille de style de carrousel (`.carousel-*`) embarquée dans chaque email, sans carrousel.                                                               | gabarit `<style id="carousel">`                                     | Faible     |
| T17 | Polices : trois familles `Inter`, `Inter_bold`, `Inter_black` au lieu d'une famille et de graisses. Fallback Tahoma/Arial présent.                                   | `@font-face` du gabarit                                             | Moyenne    |
| T18 | Préheader vide dans les 9 emails : l'aperçu de la boîte de réception montre le début du corps ou du pied de page.                                                    | `<span class="preheader"></span>`                                   | Moyenne    |
| T19 | Pas de lien « version en ligne » (non requis pour du transactionnel court, à décider).                                                                               | absent                                                              | Faible     |

## Grille des 60 critères

Statuts : **C** Conforme · **X** À corriger · **N/A** Non applicable · **?** À analyser (non testable ici). Preuve entre parenthèses.

### Éléments obligatoires

| Critère                                   | Statut | Importance | Preuve / note                                                                                                       |
| ----------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Langue déclarée (`html` et `div`)         | X      | Critique   | T1                                                                                                                  |
| `<title>` renseigné                       | X      | Moyenne    | T3 : constant                                                                                                       |
| Nom d'expéditeur reconnaissable et stable | ?      | Moyenne    | `from` vient de la configuration, non lue en production                                                             |
| Rendu en 120 DPI                          | X      | Faible     | `xmlns:v`/`xmlns:o` présents, `PixelsPerInch` présent (2 occurrences) : à confirmer, largeurs en `style` fixe en px |
| Version texte brut travaillée             | X      | Faible     | T15                                                                                                                 |
| Traduction des termes étrangers           | C      | Faible     | pas de jargon ; « email builder » repris tel quel                                                                   |
| Changements de langue indiqués            | N/A    | Faible     | pas de passage multilingue dans un même email                                                                       |
| Version en ligne                          | X      | Faible     | T19, à décider                                                                                                      |

### Structuration de l'information

| Critère                                     | Statut | Importance | Preuve / note                                            |
| ------------------------------------------- | ------ | ---------- | -------------------------------------------------------- |
| Balises sémantiques                         | X      | Critique   | `h1` et `p` présents, pas de liste ; T4 sur le titre     |
| Niveaux de titre, un seul `h1`              | X      | Critique   | un `h1` sauf pour l'email 2 (T4)                         |
| Ordre de lecture logique                    | C      | Moyenne    | logo, titre, texte, bouton, lien, pied : ordre du source |
| Email déclaré comme section indépendante    | X      | Moyenne    | T2                                                       |
| Pas de sauts de ligne pour la mise en forme | X      | Faible     | un `<br/>` dans le pied de page                          |
| Au moins un `h1`                            | X      | Faible     | T4                                                       |

### Tableaux

| Critère                              | Statut | Importance | Preuve / note                                        |
| ------------------------------------ | ------ | ---------- | ---------------------------------------------------- |
| `role="presentation"` sur les tables | C      | Critique   | toutes les `<table>` du rendu l'ont (0 sans le rôle) |

### Présentation de l'information

| Critère                                              | Statut | Importance | Preuve / note                                                                                                 |
| ---------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Tout texte non décoratif en HTML                     | C      | Critique   | titres et bouton en HTML, logo en image avec `alt`                                                            |
| Textes longs ni centrés ni justifiés                 | C      | Critique   | `text-align: left`                                                                                            |
| Corps ≥ 14 px desktop, ≥ 16 px mobile                | X      | Moyenne    | corps 18 px (conforme), pied 14 px, accroche du logo 12 px (non conforme), pas de règle mobile                |
| Interligne ≥ 150 %                                   | X      | Moyenne    | T6                                                                                                            |
| Polices lisibles                                     | C      | Moyenne    | Inter, sans empattement, graisse 400                                                                          |
| Polices de secours                                   | C      | Moyenne    | `Tahoma, Arial, sans-serif` après chaque famille                                                              |
| Éviter le tout majuscules                            | X      | Moyenne    | T9 : boutons saisis en majuscules                                                                             |
| Pas de hauteur fixe                                  | X      | Moyenne    | `height: 1px` sur le filet (décoratif, faible) ; `hr` avec `height` fixe                                      |
| Sens de lecture `direction:ltr`                      | C      | Moyenne    | présent (3 occurrences)                                                                                       |
| Pas de `hn` pour styliser                            | C      | Moyenne    | un seul `h1`, qui est un titre                                                                                |
| Espacements suffisants                               | ?      | Moyenne    | à juger sur le rendu                                                                                          |
| Informations importantes les plus visibles           | X      | Moyenne    | l'avertissement de sécurité (« prévenez l'administrateur ») est en corps courant, au même niveau que le reste |
| 2 à 3 polices maximum                                | X      | Faible     | T17 : trois noms de famille pour une police                                                                   |
| Interligne tenu sur Outlook (`mso-line-height-rule`) | C      | Faible     | présent (8 occurrences)                                                                                       |
| Feedback visuel au clic (`:active`)                  | X      | Faible     | seulement `:hover` (`bold_hover`), pas de `:active`                                                           |
| Pas de `blink` ni `marquee`                          | C      | Faible     | absents                                                                                                       |

### Images

| Critère                       | Statut | Importance | Preuve / note |
| ----------------------------- | ------ | ---------- | ------------- |
| Texte alternatif pertinent    | X      | Moyenne    | T12           |
| Images décoratives ignorées   | X      | Moyenne    | T13           |
| 1er état d'un GIF             | N/A    | Moyenne    | aucun GIF     |
| Pas de `title` sur les images | C      | Faible     | aucun         |

### Couleurs

| Critère        | Statut | Importance | Preuve / note                                                                                                                               |
| -------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Contraste WCAG | C      | Critique   | `#141414` sur blanc, `#FFFFFF` sur `#141414` et `#444444` sur blanc dépassent 4,5:1 (calcul de l'audit) ; `#DDDCDC` sur blanc est décoratif |

### Liens

| Critère                               | Statut | Importance | Preuve / note                                                     |
| ------------------------------------- | ------ | ---------- | ----------------------------------------------------------------- |
| Chaque lien explicite                 | X      | Critique   | T10                                                               |
| Boutons entièrement cliquables        | X      | Critique   | T5                                                                |
| Zones de clic ≥ 44 × 44 px            | X      | Moyenne    | zone cliquable = hauteur de ligne (29 px) ; icônes sociales 40 px |
| Liens reconnaissables sans la couleur | C      | Moyenne    | liens soulignés ; le bouton est une forme                         |
| `aria-label` sur les liens vagues     | X      | Faible     | T10 : 0 `aria-`                                                   |

### Navigation

| Critère                              | Statut | Importance | Preuve / note                                                                 |
| ------------------------------------ | ------ | ---------- | ----------------------------------------------------------------------------- |
| Éléments focusables (`tabindex="0"`) | X      | Moyenne    | 0 `tabindex` ; les `<a>` natifs sont focusables, la grille demande l'attribut |
| Pas de VML (ou habillage seul)       | C      | Moyenne    | 0 balise `<v:`                                                                |
| Pas de `a` dans du VML               | C      | Faible     | pas de VML                                                                    |
| Pas de titres dans du VML            | C      | Faible     | pas de VML                                                                    |
| Tabulation logique                   | ?      | Faible     | à tester au clavier                                                           |
| Pas trop de CTA au même endroit      | C      | Faible     | un bouton et son lien de repli                                                |

### Rédaction

| Critère                             | Statut | Importance | Preuve / note                                                                                                                                           |
| ----------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mots, phrases et paragraphes courts | X      | Moyenne    | descriptions de 2 phrases dont une longue (« Une nouvelle série de codes… ne fonctionnent plus. Si vous n'êtes pas… »), à retravailler en langage clair |
| Voix active                         | X      | Faible     | « a été réinitialisée », « a servi » (passif) à reformuler                                                                                              |

### Consultation

| Critère                      | Statut | Importance | Preuve / note                                                                                                       |
| ---------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Version mobile               | ?      | Critique   | une media query à 600 px existe (`width100pc`, paddings) ; non testée                                               |
| Pas de GIF agressif          | N/A    | Critique   | aucun GIF                                                                                                           |
| Poids et chargement          | X      | Moyenne    | ~21,6 Ko de HTML (sous les 102 Ko de Gmail), mais 5 images distantes, polices distantes et CSS de carrousel inutile |
| Largeur 100 % en mobile      | C      | Moyenne    | `width100pc` en media query ; largeurs fixes 580/640 px en desktop                                                  |
| Pas de GIF en boucle         | N/A    | Moyenne    | aucun GIF                                                                                                           |
| Dark mode logique et lisible | X      | Faible     | T14                                                                                                                 |
| Éléments auto pausables      | N/A    | Faible     | aucun élément automatique (le CSS de carrousel n'est pas utilisé)                                                   |

### Données

| Critère                  | Statut | Importance | Preuve / note                                        |
| ------------------------ | ------ | ---------- | ---------------------------------------------------- |
| Poids des visuels réduit | ?      | Faible     | images hébergées sur badsender.com, poids non mesuré |

Décompte (60 critères) : 24 conformes ou sans objet évidents, 27 à corriger, 6 à analyser, avec des critères comptés une fois par ligne ci-dessus. Les comptes exacts sont à reprendre au tableur quand la grille sera saisie dans Notion.

## Design system

Référence : [01-tokens.md](../design-system/01-tokens.md) et [02-components.md](../design-system/02-components.md).

| Sujet            | Email actuel                                                      | Design system                                                      | Écart                                         |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| Police           | Inter (3 familles factices, webfont gstatic)                      | Inter, graisses 300 à 700                                          | Faible : bonne police, mauvaise mise en œuvre |
| Couleur d'action | bouton `#141414` (noir)                                           | primaire `#093040`, accent `#00ACDC` pour les CTA et liens         | Fort                                          |
| Forme du bouton  | pilule, rayon 50 px, padding 20/40                                | rayon de bouton 5 px                                               | Fort                                          |
| Identité         | logos Badsender (badsender.com), pied de page marketing Badsender | marque LePatron ; couleurs et logo par groupe prévus (white-label) | Fort                                          |
| Mode sombre      | absent                                                            | non spécifié dans les jetons                                       | À décider                                     |
| Jetons           | valeurs en dur dans le gabarit                                    | jetons nommés                                                      | Moyen                                         |

Lecture : le gabarit date d'un habillage de campagne Badsender (images datées « 20211007 »). Il a été repris tel quel pour les emails produit.

## Multilingue

| Sujet                        | Constat                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Langues                      | `fr` et `en` seulement ; une autre langue de `user.lang` retombe sur l'anglais, sans journal ni signal.                                                                                                |
| Déclaration                  | `lang="en"` figé (T1) ; le contenu en français est donc lu avec la voix anglaise par un lecteur d'écran.                                                                                               |
| Sujets et texte brut         | partiellement non traduits (T7, T15).                                                                                                                                                                  |
| Emplacement des textes       | `email-template.js`, `two-factor.emails.js`, `email-code.js` : hors de `locales/` (`fr.js`, `en.js`).                                                                                                  |
| Texte composé                | `Un nouvel appareil de confiance : Firefox 130, Linux` : l'ordre des mots et la ponctuation sont fixés dans le code ; l'espace avant les deux-points est une espace simple, pas insécable en français. |
| Gabarits de texte avec jeton | `title.replace('{code}', …)` : remplacement manuel, sans pluriel ni ordre variable.                                                                                                                    |
| Format du code               | six chiffres dans le titre, sans séparation (« 284910 ») : lu comme un nombre par un lecteur d'écran.                                                                                                  |
| Dates et durées              | « 10 minutes », « 30 jours » écrits dans le texte, doublés avec les constantes `EMAIL_CODE_TTL_MS` et la durée de confiance : risque de divergence si la constante change.                             |
| Direction                    | `direction:ltr` fixe : pas de langue RTL prévue.                                                                                                                                                       |

## Priorités proposées

1. **Gabarit, une fois pour tous** (T1, T2, T3, T4, T5, T6, T9, T12, T13, T16, T17, T18) : une seule refonte du HTML corrige l'essentiel des critères critiques.
2. **Textes** (T7, T8, T10, T15, rédaction) : un jeu de textes par email, avec un libellé de bouton propre à chaque email (ou pas de bouton quand il n'y a rien à faire, comme pour le code).
3. **Design system** : primaire/accent, bouton à 5 px, logo LePatron et couleurs du groupe, Inter en une famille.
4. **Multilingue** : textes dans `locales/`, `lang` dynamique, sujets traduits, langue de repli explicite.
5. **Tests** : rendu de chaque email dans les deux langues, assertions sur `lang`, `<title>`, `h1`, `role`, `alt`, sujets.

## Décisions (2026-11-19)

- **Pied de page** : une ligne courte (nom du produit, contact, lien vie privée) sur tous les emails de sécurité. Plus de « détruisez ce message », plus d'icônes sociales.
- **Marque** : LePatron, couleurs par défaut (primaire `#093040`, accent `#00ACDC`). Le groupe du membre n'est pas passé au rendu.
- **Mode sombre** : traité (logo en PNG transparent, couleurs lisibles quand le client inverse).
- **Langues** : fr et en seulement, comme l'application. Le repli sur l'anglais devient explicite (journalisé).
- **Email de bienvenue** : voulu, distinct de la réinitialisation. Il est la première initialisation du mot de passe. Un compte créé n'a ni mot de passe ni lien (`status: to-be-initialized`) : l'admin lui envoie le lien avec `adminResetPassword`. Distinction retenue : l'état du compte, lu avant que l'envoi n'efface le mot de passe et ne pose le lien. Ni mot de passe ni lien : bienvenue. Sinon : nouveau mot de passe. Limite connue : un lien de bienvenue renvoyé avant d'avoir servi est un « nouveau mot de passe », et un compte désactivé puis réactivé est de nouveau accueilli. Pas de champ en plus dans le schéma.

## Reproduire

Le script qui produit les 18 rendus remplace `mail.send` par une capture, avec `NODE_ENV=test`, puis appelle `renderEmail` et `sendTwoFactorEmail`. Il vit dans le répertoire temporaire de la session et n'est pas dans le dépôt : à ajouter sous forme de test Jest au moment de la refonte (priorité 5).

## Suite

Ce qui a été fait après l'audit (la refonte, la revue de code, l'identité retenue, le dégradé, les images hébergées) est dans [refonte.md](./refonte.md). La règle qui s'applique aux nouveaux emails de l'application est dans le [design system](../design-system/06-emails.md).
