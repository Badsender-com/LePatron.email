# Brief de design — panneaux de double authentification à la connexion

## Contexte

La double authentification (ADR 0008, PR #1320 à #1322) ajoute trois étapes après le mot de passe, rendues dans la carte de connexion (`packages/ui/routes/account/login/index.vue`) :

| Étape serveur    | Composant                                 | États                                                                        |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `verify`         | `components/account/two-factor-code.vue`  | code d'application, code par email (+ « Renvoyer un code »), code de secours |
| `setup`          | `components/account/two-factor-setup.vue` | choix de la méthode, QR code + clé, code envoyé par email                    |
| `recovery-codes` | `components/account/recovery-codes.vue`   | dix codes affichés une fois, copier, télécharger, « J'ai noté »              |

Ces panneaux reprennent la carte Vuetify d'origine de la page de connexion. Ils ne suivent pas le Design System **LePatron**, alors que l'écran d'autorisation d'un assistant MCP (`routes/oauth/consent/_uid.vue`, maquette « Panneau d'autorisation MCP ») le suit déjà, sur le même fond et avec le même logo. Un membre qui connecte Claude ou ChatGPT passe de l'un à l'autre en quelques secondes : les deux écrans doivent paraître faire partie du même produit.

**Objectif :** aligner les trois étapes sur la grammaire de l'écran de consentement, sans toucher au parcours serveur ni aux routes d'API.

## Constat (avant)

Captures : `docs/design/double-authentification/avant/`.

1. **Un titre qui ne dit pas l'étape.** La barre « Connexion » reste la même du mot de passe aux codes de secours. Rien ne dit « Vérification en deux étapes » ni « Configurez… ».
2. **Une flèche retour ambiguë.** Elle ramène à la saisie de l'email et efface le mot de passe, sans le dire. Aucun rappel du compte en cours de connexion.
3. **Boutons en capitales** (« VALIDER », « RENVOYER UN CODE », « COPIER »). Le DS impose la casse de phrase.
4. **Icônes MDI** (`prepend-icon="lock"`, `email`) à gauche d'un champ souligné Vuetify. Le DS impose Lucide, et des champs avec le libellé au-dessus, 38 px, bordure `gray-300`, `r-sm`, halo accent au focus.
5. **Alignement mêlé.** Le conteneur centre le texte (`text-align: center`) : les consignes sont centrées, les champs et les cases alignés à gauche.
6. **Largeur variable.** La carte occupe 5 colonnes sur 12, soit environ 640 px sur un écran de 1280 px, contre 480 px pour le consentement. Ombre `elevation-24` au lieu de l'ombre du consentement.
7. **Le code de secours est caché** dans une légende grise sans action. Le même champ accepte les deux formats, sans le dire.
8. **Les erreurs passent uniquement par le snackbar** et le champ se vide. Rien ne reste sur le champ fautif.
9. **La configuration n'a pas d'étapes visibles.** Un groupe radio sans explication, puis un bloc de texte, le QR code, la clé brute, le champ. La clé n'a pas de bouton « Copier ».
10. **Les codes de secours se lisent mal** : petites puces grises, actions en capitales, aucun avertissement visuel alors qu'ils ne seront plus affichés. « Continuer » désactivé est bleu pâle.
11. **Aucune signature** « Powered by Badsender » sous la carte, contrairement au consentement.

## Référence

- **DS LePatron** (artefact « LePatron », qui fait foi) : tokens, `Btn`, `Badge`, `Avatar`, `Icon` (Lucide), règles `CopyField`, `StepsExplainer`, `MfaMembers`, `CompanySettings`.
- **Écran de consentement MCP** : code dans `routes/oauth/consent/_uid.vue` (branches MCP), maquette « Panneau d'autorisation MCP ».

Ce qu'on reprend du consentement, tel quel :

| Élément           | Règle                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Fond              | `v-primary-base` qui fonce vers le bas, logo `logo_lepatron_dark-bg`, « Email Builder by Badsender » 12 px `w-ink-soft` |
| Carte             | 480 px (`min(480px, 100vw - 32px)`), blanche, `r-md`, ombre `0 12px 32px rgba(13,43,62,.18)`, sans barre d'outils       |
| En-tête           | Centré, padding 32/32/24 : pastille 56 px, titre h2 20 px 600 `v-primary-base`, phrase 14 px `gray-700`                 |
| Compte            | Bloc `gray-50`, bordure `gray-200`, `Avatar` 36 px, nom + adresse, lien « Changer de compte »                           |
| Sections          | Eyebrow `micro` 11 px 500 capitales `gray-600`                                                                          |
| Option à cocher   | Cadre `gray-300` 7 px, accent + `accent-tint-selected` une fois cochée                                                  |
| Pied              | Bordure haute `gray-200`, actions à droite, `cta` à l'extrême droite, secondaire en `text` à sa gauche                  |
| Mobile (≤ 480 px) | Paddings 20 px, actions en pleine largeur, l'action principale au-dessus                                                |
| Signature         | « Powered by » + logo Badsender blanc sous la carte                                                                     |

## Principes

1. **Une étape = un titre.** Le titre dit ce qu'on attend du membre, la phrase dit comment.
2. **On sait toujours qui se connecte.** Le bloc compte remplace la flèche retour. « Changer de compte » ramène à l'email, et le dit.
3. **Le chemin de secours est une action, pas une légende.** « Utiliser un code de secours » bascule le champ (libellé, format, aide). « Utiliser mon application » fait l'inverse.
4. **L'erreur reste sur le champ.** Bordure `color-error`, message `danger-ink` sous le champ (`role="alert"`), le code saisi reste sélectionné. Le snackbar ne sert plus qu'à l'étape expirée, qui renvoie au mot de passe.
5. **La configuration se lit en étapes.** Eyebrow « Configuration · étape N sur 3 », le QR code accompagné de trois consignes numérotées (grammaire `StepsExplainer`), la clé dans un `CopyField`.
6. **Ce qui ne sera plus affiché est signalé.** Les codes de secours vont dans un cadre `warning-border` sur `tint-warning-soft`, comme le secret d'un client MCP (`ClientList`).

## Spécification par écran

### Vérification — application (`verify`, `totp`)

- Pastille accent, icône `Smartphone`. Titre « Vérification en deux étapes ». Phrase « Saisissez le code à 6 chiffres affiché par votre application d'authentification. »
- Bloc compte (avatar, adresse, « Changer de compte »).
- Champ « Code de vérification » : 48 px, `font-mono` 20 px, chiffres espacés, centré, `inputmode="numeric"`, `autocomplete="one-time-code"`, placeholder « 000 000 ».
- Lien sous le champ : « Utiliser un code de secours ».
- Option à cocher « Faire confiance à cet appareil pendant 30 jours », avec la phrase « Vous ne saisirez plus de code sur ce navigateur. »
- Pied : `cta` « Valider ».

### Vérification — email (`verify`, `email`)

- Icône `Mail`. Phrase « Saisissez le code à 6 chiffres envoyé à j•••@badsender.com. » (adresse masquée, connue du formulaire).
- Pied : « Renvoyer un code » en `text` à gauche, avec un délai affiché après envoi (« Renvoyer dans 30 s ») ; `cta` « Valider ».

### Vérification — code de secours, et erreur

- Même carte, champ « Code de secours », format `xxxx-xxxx`, aide « Chaque code ne sert qu'une fois. De nouveaux codes vous seront donnés après la connexion. »
- Lien « Utiliser mon application » (ou « Recevoir un code par email »).
- État erreur : bordure `color-error`, message « Code incorrect. Il vous reste 3 essais. » (le nombre d'essais n'est montré que si l'API le renvoie).

### Configuration — choix de la méthode (`setup`, sans `setup`)

- Eyebrow « Configuration · étape 1 sur 3 ». Icône `ShieldCheck`. Titre « Protégez votre compte ». Phrase « {Entreprise} exige une vérification en deux étapes : après votre mot de passe, vous saisirez un code. » (nom de l'entreprise s'il est connu, sinon « Votre entreprise »).
- Deux cartes radio (vrais `<input type="radio">`) : `Smartphone` « Application d'authentification » + badge `accent` « Recommandé », « Google Authenticator, Microsoft Authenticator, 1Password… » ; `Mail` « Code par email », « Un code à chaque connexion, envoyé à j•••@badsender.com ».
- Pied : `cta` « Continuer ».

### Configuration — application (`setup.method === 'totp'`)

- Eyebrow « étape 2 sur 3 ». Titre « Associez votre application ».
- Rangée : QR code 160 px dans un cadre `gray-200` à gauche, trois consignes numérotées à droite (1. Ouvrez votre application. 2. Ajoutez un compte et scannez le QR code. 3. Saisissez le code à 6 chiffres affiché.). Sous 480 px, le QR passe au-dessus.
- « Impossible de scanner ? » : `CopyField` avec la clé, groupée par 4 caractères, bouton « Copier ».
- Champ code + option « Faire confiance ». Pied : « Changer de méthode » en `text`, `cta` « Activer ».

### Configuration — email (`setup.method === 'email'`)

- Eyebrow « étape 2 sur 3 ». Icône `MailCheck`. Titre « Vérifiez votre adresse ». Phrase « Un code vient d'être envoyé à j•••@badsender.com. »
- Champ code + option. Pied : « Renvoyer un code », `cta` « Activer ».

### Codes de secours (`recovery-codes`)

- Eyebrow « étape 3 sur 3 » après une configuration. Après l'usage d'un code de secours : pas d'eyebrow, phrase « Vous avez utilisé un code de secours : voici une nouvelle série, les anciens ne marchent plus. » Icône `KeyRound`. Titre « Gardez vos codes de secours ».
- Cadre `warning` : « Ils ne seront plus affichés. Chaque code vous connecte une fois sans votre application. »
- Grille 2 × 5 en `font-mono` 14 px `gray-900`, numérotée, sur `gray-50`.
- Boutons `outlined` sous la grille : `Copy` « Copier », `Download` « Télécharger (.txt) ». « Copié » vert pendant 2 s (règle `CopyField`).
- Option à cocher « J'ai noté mes codes en lieu sûr ». Pied : `cta` « Continuer vers LePatron », désactivé à 45 % d'opacité tant que la case n'est pas cochée.

## Accessibilité

- Un `<h1>` par étape (le titre), le focus va au champ de code à l'affichage.
- Les messages d'erreur sont liés au champ (`aria-describedby`) et annoncés (`role="alert"`).
- Cartes radio : vrai groupe `radiogroup` avec `<legend>`, focus visible.
- Le blanc sur `v-accent-base` (bouton `cta`) est à 2,7:1 : contraste hérité de la marque, gardé comme sur le consentement. À trancher pour tout l'écran de connexion si l'objectif RGAA l'exige (`v-primary-base` pour l'action principale).
- Cible tactile de 44 px au minimum sur mobile.

## Hypothèses et hors périmètre

- **Aucun changement d'API.** L'adresse masquée vient du champ email déjà saisi. Le nom de l'entreprise n'est montré que si `pending-step` le renvoie déjà ; sinon « Votre entreprise ».
- Le nombre d'essais restants et le délai de renvoi ne sont affichés que si le serveur les donne. Sinon, message générique, et le bouton « Renvoyer » se grise 30 s côté client.
- Les étapes mot de passe et email gagneraient à suivre la même carte. Elles entrent dans la même PR : sinon la carte change de largeur et de style entre le mot de passe et le code.
- Le centrage et l'ombre du layout `centered` restent ; la carte sort de la colonne comme sur le consentement.

## Découpage proposé de la PR

1. Un composant `BsAuthCard` (fond, logo, carte 480, en-tête, bloc compte, pied, signature) extrait de l'écran de consentement, que le consentement réutilise.
2. Les trois panneaux 2FA et les étapes email / mot de passe réécrits sur ce composant, libellés FR/EN mis à jour.
3. Tests : focus, bascule code de secours, erreur sur le champ, case « J'ai noté » qui débloque « Continuer ».
4. Une carte `AuthCard` ajoutée au DS LePatron une fois validée.

Maquette avant / après : canvas « Double authentification — connexion » (https://claude.ai/artifact/BHg7QvbUakAAN7tLdZnm7f).

## Mise en œuvre

Branche `feat/auth-card-two-factor`, depuis `develop` :

- `components/account/auth-card.vue` (`BsAuthCard`) : marque, carte 480, en-tête, bloc compte, pied, signature. Le consentement MCP n'est pas encore sur `develop` : il pourra adopter la carte une fois fusionné.
- `auth-code-field.vue` (champ de code, erreur sur le champ) et `auth-option.vue` (option à cocher encadrée).
- Les étapes email et mot de passe de `routes/account/login/index.vue`, et les trois panneaux 2FA, réécrits sur cette carte. « Renvoyer un code » passe sous le champ, avec un délai de 30 s.
- Captures après refonte : `apres/`.
