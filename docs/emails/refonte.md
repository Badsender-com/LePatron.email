# Refonte des emails de la plateforme

Ce qui a été fait après l'[audit](./audit-accessibilite.md) : l'état des constats, la revue de code, et l'identité retenue avec ses écarts. Inventaire des emails : [README.md](./README.md). La règle pour les nouveaux emails : [design system, 06-emails.md](../design-system/06-emails.md).

## Refonte : ce qui est fait (2026-11-19)

Le gabarit est réécrit ([account-email.html](../../packages/server/email-templates/account-email.html)), les textes et l'API de rendu aussi ([email-template.js](../../packages/server/email-templates/email-template.js)). Les tests de contrat ([tests/server/emails/](../../tests/server/emails/)) couvrent les 10 envois en français et en anglais.

| Constat  | État                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| T1       | corrigé : `lang` du membre sur `html` et sur la `div role="article"`                                                                        |
| T2       | corrigé                                                                                                                                     |
| T3       | corrigé : `<title>` = titre de l'email                                                                                                      |
| T4       | corrigé : un `h1` partout                                                                                                                   |
| T5       | corrigé : le `<a>` est un bloc avec 12 × 20 px de marge, toute la pilule se clique (45 px de haut, 48 sous 480 px)                          |
| T6       | corrigé : corps et pied 14/21, titre 20/30 (150 %) ; corps 16/24 sous 480 px                                                                |
| T7, T8   | corrigés : sujets traduits. Le préfixe par défaut de la configuration passe de `Email builder LePatron` à `LePatron`                        |
| T9, T10  | corrigés : plus de majuscules saisies, un libellé par email (« Choisir mon mot de passe », « Ouvrir LePatron »), pas de bouton pour le code |
| T11      | corrigé : pied de page de deux lignes                                                                                                       |
| T12, T13 | corrigés : plus d'icônes sociales, logo avec `alt="LePatron"`, icônes décoratives `alt=""`                                                  |
| T14      | traité : `color-scheme`, `prefers-color-scheme: dark`, pictogramme coloré lisible sur fond clair et sombre. **Non vu dans un client réel**  |
| T15      | corrigé : texte brut = titre, description, lien, mention                                                                                    |
| T16, T17 | corrigés : plus de CSS de carrousel, une seule famille Inter (police variable de 400 à 700)                                                 |
| T18      | corrigé : préheader écrit pour chaque email                                                                                                 |
| T19      | non traité (transactionnel court)                                                                                                           |

Contrastes calculés : texte 10,3:1, texte discret 4,8:1, bouton et liens 13,9:1, code 12,4:1 ; en mode sombre texte 10,5:1, texte discret 6,1:1, bouton 5,3:1, lien 9,2:1.

Pour la bienvenue : un compte sans mot de passe ni lien reçoit « Bienvenue sur LePatron », les autres reçoivent « Nouveau mot de passe » (administrateur ou demande de la personne).

### Reste à vérifier à la main

- Rendu dans Gmail, Outlook (Windows), Apple Mail, mobile : non fait.
- Lecteur d'écran (NVDA, VoiceOver) : non fait. Les critères « Tabulation logique », « Espacements » et « Version mobile » restent **À analyser**.
- Le logo et les icônes sont servis par l'application (`/media/email/`) : en développement (`localhost`), un client mail ne peut pas les charger. En production, ils suivent `config.host`.
- `tabindex="0"` sur le bouton et `aria-label` : non ajoutés, le lien natif est déjà focusable et son libellé est explicite. La grille les demande : à trancher.
- Revue du 2026-11-19 : la première version testait seulement l'absence de mot de passe, et accueillait à tort un compte déjà réinitialisé dont le premier email était parti. Corrigé (mot de passe **et** lien absents), avec tests du second envoi.

### Revue du code (2026-11-19)

Corrigé après relecture :

- **Bienvenue** : décision par « ni mot de passe ni lien » (voir plus haut), tests des envois suivants.
- **Bouton sous Outlook Windows** : `mso-padding-alt` sur la cellule, le moteur Word ignore le remplissage du `<a>`. Le test ne vérifie que le HTML, pas ce rendu.
- **Confirmation** : le texte ne dit plus « nouveau mot de passe », il peut s'agir d'un premier.
- **Typographie** : espace insécable avant les deux-points en français, titre « Connexion avec un code de secours », pied de page en phrase complète, voix active.
- **Préheader** : rempli pour que les boîtes de réception n'y collent pas le texte suivant.
- **Langue** : `FR`, `fr-FR` lus comme `fr` ; valeur inconnue journalisée entre guillemets et coupée.
- **Tests** : textes des trois emails de mot de passe distingués, « 7 jours » lié à `tokenExpire`, échappement du navigateur et du système d'un appareil, langues absentes, interligne vérifié sur chaque taille.

Corrigé après la revue de la PR (2026-11-19) :

- **Carte fluide** : `width: 100%; max-width: 480px`, sans dépendre des media queries ; un tableau fixe de 480 px sous Outlook pour Windows.
- **Vocabulaire** : « email » et non « mailing » (GLOSSARY.md), « admin technique » et « entreprise » comme dans l'interface ; la confirmation de mot de passe renvoie à « un administrateur de votre entreprise », un admin entreprise pouvant aussi envoyer le lien.
- **Lien de mot de passe** : l'adresse est encodée dans le chemin (le `@` reste), et l'interface l'encode aussi dans ses appels.
- **Icônes** : une seule liste (`email-icons.js`), lue par le gabarit et par `scripts/build-email-images.js`, et un test vérifie que chaque icône a son PNG.

Non corrigé :

- Les polices viennent de fonts.gstatic.com : un appel à Google à l'ouverture. La charte tolère les polices personnalisées avec repli ; à décider si on veut s'en passer (repli Arial/Tahoma, déjà en place).
- La page de confidentialité est la page française pour les lecteurs anglais : pas de page anglaise connue.

## Identité : le design system de l'application (2026-11-19, après retour)

Les emails de notification de l'application suivent **le design system de l'application**, pas celui du site. Les artefacts de référence sont « LePatron App - Design System » (design, ce qui est _dans_ le produit) et « LePatron - Brandbook » (voix, ce qui parle _de_ LePatron). Le README de l'app le dit : couleurs, typographie, composants, « this system only » ; le brandbook seul pour le site, les présentations et les emails marketing. Ni Fraunces, ni la toile, ni le papier patron dans l'app.

Deux tentatives précédentes se sont trompées de référence. La première prenait le `secondary` `#265090` du code de la page de connexion pour fond ; le design system de l'app dit que la carte de connexion est posée sur le **primaire** `#093040` (« deep teal »). La deuxième habillait les emails aux couleurs du site (toile, safran, Fraunces).

| Élément     | Design system de l'application                                                   | Email                                                                                   |
| ----------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Fond        | primaire `#093040`, dégradé radial accent vers primaire à 50 % (en bas à droite) | idem, à l'identique au-dessus de 960 px ; fond uni `#093040` jusqu'à 960 px et en repli |
| Logo        | variante pour fond sombre, sans signature                                        | idem, en PNG hébergé, au-dessus de la carte                                             |
| Carte       | blanche, 480 px, rayon 10 px, ombre `shadow-modal`, filet `gray-200`             | idem, fluide jusqu'à 480 px (`max-width`, sans media query), 480 px fixes sous Outlook  |
| En-tête     | pastille ronde 56 px (`tint-accent`), icône lucide en `accent-darken1`           | idem, une icône par type d'email                                                        |
| Titre       | Inter 20 px / 600, primaire                                                      | idem, centré, interligne 150 %                                                          |
| Texte       | Inter 14 px, `gray-700`                                                          | idem, aligné à gauche ; 16 px sous 480 px                                               |
| Actions     | rangée à droite sous un filet, bouton à la largeur du libellé                    | idem ; pleine largeur sous 480 px (48 px de haut), comme la carte                       |
| Bouton      | rayon 5 px (`r-sm`), 500, sans majuscules, survol qui assombrit                  | idem                                                                                    |
| Vocabulaire | « email » est ce que l'entreprise conçoit (GLOSSARY.md), jamais « mailing »      | la bienvenue parle d'emails                                                             |

Écarts assumés, la grille d'accessibilité l'emportant :

- **Le bouton est en primaire `#093040` avec du blanc (14:1), pas en accent.** Blanc sur l'accent `#00ACDC` fait 2,7:1, sous la grille (critère critique). Le README de l'app prévoit ce cas : « là où l'accessibilité est exigée, le primaire pour l'action principale, et le dire ». Survol `#072530`. En mode sombre, où le primaire disparaîtrait, le bouton passe à l'accent avec un texte `#093040` (5,3:1).
- **Les liens sont en primaire souligné** (13,9:1), pas en `accent-darken1` (3,6:1 sur blanc, sous 4,5:1). Le soulignement reste.
- **La description est alignée à gauche**, la carte de l'application la centre : « textes longs ni centrés ni justifiés » (critique). Le titre et l'icône restent centrés.
- **Le pied de page est un texte de 14 px** (le design system a 12 px pour la signature) : la grille demande 14 px.

**Le code de vérification** est mis en exergue discrètement : encart teinté `tint-accent` (`#e0f6fc` sur blanc), coins de 7 px, police mono 28 px / 600 en primaire (12:1), lettres espacées de 0,3 em comme le champ de code de l'application (`code-input`). En mode sombre : fond `#16394a`, texte `#f3f4f6`. Contrairement à la première version, il n'est plus dans le titre (`h1`) ni dans le sujet.

**Le bloc bénéfices de la bienvenue** : encart `surface-muted` (`#fafafa`), filet `gray-200`, coins de 7 px (le bloc de compte de la carte de connexion), titre en `h2` 16 px / 600, puis trois lignes picto + phrase. Pictos : `blocks` (blocs conçus pour la marque), `badge-check` (vérifié avant l'envoi), `languages` (déclinaisons), en tuile ronde `tint-accent` 40 px, `alt=""` puisque le texte porte le sens. La liste garde sa sémantique sans puces (`role="list"`). En mode sombre : fond `#0e2531`.

**Le fond en dégradé.** L'email reprend le dégradé de l'écran de connexion **à l'identique** : `radial-gradient(at 100% 100%, accent 0%, primaire 50%)`, avec son rayon proportionnel, sur le primaire uni `#093040` déclaré avant et en attribut `bgcolor`. Un client qui ne dessine pas les dégradés (Outlook pour Windows, d'après nos règles) garde l'aplat.

**Jusqu'à 960 px de large (la bascule « tablette » de l'application), le dégradé est coupé** par une media query (`background-image: none`) : le fond est le primaire uni. Le pied de page, dernier élément de l'email, est en blanc, et sous cette largeur il tombe sur la lueur et passe sous 4,5:1. Mesuré et calculé :

| Largeur | Avec le dégradé | Retenu             |
| ------- | --------------- | ------------------ |
| 500 px  | blanc 2,9:1     | fond uni, 13,9:1   |
| 600 px  | 3,3:1           | fond uni, 13,9:1   |
| 760 px  | 4,0:1           | fond uni, 13,9:1   |
| 960 px  | 4,6:1           | fond uni, 13,9:1   |
| 961 px  | 4,6:1           | dégradé, **4,6:1** |
| 1000 px | 4,7:1           | dégradé, 4,7:1     |
| 1280 px | 5,3:1           | dégradé, 5,3:1     |

Le calcul (ellipse « farthest-corner », rayons égaux aux côtés de la boîte fois √2, accent à 0 %, primaire à 50 %) a été confirmé sur le rendu réel, sur 8 largeurs de 390 à 1920 px et deux emails (bienvenue, code) : 4,6:1 au pire à 961 px. Le test calcule la même chose à partir du CSS de l'email, pour trois hauteurs d'email et des fenêtres de 500 à 1600 px.

Le fond s'étend à la hauteur de la fenêtre là où le client l'accepte (`height: 100%` sur `html`, `body`, le tableau de la page et son conteneur), pour que la lueur reste en bas à droite de la fenêtre comme sur l'écran. Le dégradé n'est que sur le fond, jamais sous la carte ni sous un texte long.

**Limite connue :** la coupure sous 960 px repose sur les media queries. Un client qui les ignore et dessine les dégradés (certaines apps de messagerie sur mobile) afficherait la lueur sous le pied de page, à 3,2:1 au pire sur un téléphone. Support à confirmer par un test Litmus ou Email on Acid, non fait ici.

Voix (brandbook) : vouvoiement, phrases courtes, des faits plutôt que des adjectifs, jamais « révolutionnaire », « booster », « clé en main ». Le nom s'écrit LePatron. Les trois bénéfices de la bienvenue reprennent trois différenciateurs du brandbook et du site. Le texte reste à valider.

Le logo et les icônes sont des **images hébergées par l'application** (`public/media/email/`, servies sans authentification avant la session) et liées par des adresses absolues : `<site>/media/email/logo.png`, avec le schéma et l'hôte des autres liens (`config.host`, https hors développement). Ce choix remplace des pièces jointes `cid:` : il garde un message léger, mais il suppose que l'hôte soit joignable par le client mail (donc pas `localhost` en production) et que les images ne soient pas bloquées ; le `alt` du logo (« LePatron ») reste lisible sans elles. Les icônes sont reconstruites par `node scripts/build-email-images.js` depuis les icônes lucide des pages de connexion.

Dérive à connaître : la page de connexion de l'application (`packages/ui/layouts/centered.vue`) est sur le `secondary` `#265090` ; le design system la décrit sur le primaire `#093040`. Les emails suivent le design system.

Vu en rendu : Chromium (bureau, mobile 390 px, mode sombre forcé). Pas vu : Gmail, Outlook, Apple Mail.
