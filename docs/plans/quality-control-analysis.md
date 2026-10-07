# Analyse du Contrôle Qualité à l'Export

> **Objectif** : Documenter exhaustivement les contrôles qualité existants lors de l'export d'un template/mailing dans LePatron.email.
>
> **Date** : 20 mars 2026
> **Branche** : `feat/quality-control`
>
> **Mise à jour** : octobre 2026, QC v2 (`feat/quality-control-v2` et les PR empilées au-dessus). Les contrôles côté éditeur passent par un moteur de règles (`packages/editor/src/js/ext/quality/`), affichés dans le panneau « Tester votre email » ; certains demandent au serveur de mesurer les liens et les images. Les sections « Contrôles côté client », « Contrôles qualité côté serveur » et l'annexe décrivent l'état du QC v2, ses choix sont dans [l'ADR 0003](../adr/0003-quality-control-v2.md). Le reste du document est inchangé.

---

## Table des matières

1. [Introduction](#introduction)
2. [Architecture du contrôle qualité](#architecture-du-contrôle-qualité)
3. [Contrôles côté client (Editor)](#contrôles-côté-client-editor)
4. [Contrôles côté serveur](#contrôles-côté-serveur)
5. [Tableau récapitulatif](#tableau-récapitulatif)
6. [Opportunités d'amélioration](#opportunités-damélioration)

---

## Introduction

LePatron.email dispose d'un système de contrôle qualité réparti entre le client (éditeur) et le serveur. Ces contrôles sont exécutés à différents moments du cycle de vie d'un mailing : édition, export, envoi de test, et envoi vers un ESP (Email Service Provider).

### Flux d'export typique

```
┌─────────────────────────────────────────────────────────────────┐
│                         ÉDITEUR (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Utilisateur clique "Exporter"                                │
│  2. runQualityChecks() → règles : tracking, liens, images, poids │
│  3. Affiche warnings si problèmes détectés                       │
│  4. Envoie requête au serveur                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVEUR                                  │
├─────────────────────────────────────────────────────────────────┤
│  5. Validation accès utilisateur                                 │
│  6. Validation existence mailing                                 │
│  7. Processing HTML (nettoyage, encodage)                        │
│  8. Extraction et validation images                              │
│  9. Génération archive ZIP                                       │
│ 10. Upload FTP/CDN si configuré                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture du contrôle qualité

### Fichiers impliqués

| Fichier                                                      | Rôle                            | Couche  |
| ------------------------------------------------------------ | ------------------------------- | ------- |
| `packages/editor/src/js/ext/quality/`                        | Moteur et règles du QC          | Client  |
| `packages/editor/src/js/ext/badsender-control-quality.js`    | Modale du tracking obligatoire  | Client  |
| `packages/editor/src/js/ext/quality/quality-review.js`       | État du panneau, appels serveur | Client  |
| `packages/editor/src/js/vue/components/quality-drawer/`      | Panneau « Tester votre email »  | Client  |
| `packages/server/mailing/quality-resources.service.js`       | Liens et images mesurés         | Serveur |
| `packages/server/mailing/mailing-quality.service.js`         | Résultats ignorés               | Serveur |
| `packages/server/share-link/`                                | Lien de partage public          | Serveur |
| `packages/editor/src/js/ext/badsender-server-storage.js`     | Intégration QC à l'export       | Client  |
| `packages/editor/src/js/vue/components/esp/esp-send-mail.js` | QC avant envoi ESP              | Client  |
| `packages/server/mailing/mailing.service.js`                 | Validations métier              | Serveur |
| `packages/server/mailing/download-zip.controller.js`         | Export ZIP                      | Serveur |
| `packages/server/mailing/send-test-mail.service.js`          | Validation emails test          | Serveur |
| `packages/server/profile/profile.service.js`                 | Validation profils ESP          | Serveur |
| `packages/server/utils/process-mosaico-html-render.js`       | Processing HTML                 | Serveur |
| `packages/server/utils/download-zip-markdown.js`             | Notices export                  | Serveur |
| `packages/editor/src/js/converter/checkmodel.js`             | Validation modèle données       | Client  |

---

## Contrôles côté client (Editor)

### Le moteur : `ext/quality/engine.js`

`runQualityChecks(viewModel, { html })` est appelé par `quality-review.js` (`viewModel.quality`) : depuis le panneau (« Lancer le contrôle », « Relancer »), au téléchargement (`badsender-server-storage.js`, sur l'export qui sert au ZIP) et après un envoi ESP (`esp-send-mail.js`, sur le HTML envoyé). Les règles locales (`DEFAULT_RULES`) répondent d'abord ; les règles distantes (`REMOTE_RULES`) lisent ensuite la réponse de `POST /api/mailings/:mailingId/quality/resources`.

- Le HTML est exporté une fois, puis analysé une fois avec `DOMParser` (`quality/context.js`). Le contexte contient aussi les blocs de tous les conteneurs du modèle (`*Blocks`) et la configuration de l'éditeur (`ctx.config` : route des placeholders, configuration du tracking). Les règles ne lisent que ce contexte.
- **On ne juge que l'édition du client.** Un nœud exporté est rattaché à son bloc par l'`id` de la racine du bloc, conservé dans l'export. Ce qui est hors bloc (cadre du template) n'est jamais jugé.
- Chaque résultat porte sa règle, sa catégorie, sa sévérité, son bloc (`blockId`, libellé « Hero #2 »), le chemin de la propriété et une empreinte : `règle|bloc|propriété|hash(valeur fautive)|rang`. Le rang distingue deux résultats identiques d'un même bloc.
- Une règle qui plante est marquée `error` sans arrêter les autres. Si le contexte ne peut pas être construit, aucun résultat : le QC ne bloque jamais l'export.

### Les règles (`ext/quality/rules/`)

Les seuils sont ceux de la revue d'équipe du 1er octobre 2026. Le catalogue détaillé, avec les motifs exacts, est tenu dans la page Notion du chantier.

| Règle                       | Catégorie     | Sévérité         | Ce qui est signalé                                                                                                                                                          |
| --------------------------- | ------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subject`                   | Rédaction     | Warning / Info   | Objet vide (W), plus de 40 caractères (I) ou de 60 (W), faux « RE: » ou « Fwd: » (W), majuscules, `!!` ou plusieurs emojis (I). Seulement si l'entreprise a les métadonnées |
| `preheader`                 | Rédaction     | Warning / Info   | Absent, désactivé ou resté au texte du template (W), répète l'objet (W), plus de 100 caractères (I) ou de 140 (W), variables exclues                                        |
| `merge-tags`                | Rédaction     | Erreur           | Variable de personnalisation non fermée, dans les textes, les liens, l'objet ou le préheader                                                                                |
| `empty-blocks`              | Rédaction     | Warning          | Bloc sans texte ni image alors que son modèle prévoit du texte                                                                                                              |
| `uppercase-text`            | Accessibilité | Info             | 6 mots ou plus en majuscules d'affilée                                                                                                                                      |
| `hidden-text`               | Accessibilité | Erreur           | Texte masqué par un style du client (`display:none`, `opacity:0`, taille ≤ 2 px…)                                                                                           |
| `small-font`                | Accessibilité | Warning          | Taille saisie par le client sous 14 px, ou 12 px dans un bloc d'en-tête ou de pied de page                                                                                  |
| `color-contrast`            | Accessibilité | Warning / Erreur | Contraste sous le niveau AA (4,5:1, 3:1 en grand texte), le message donne l'idéal AAA ; sous 1,5:1 en erreur                                                                |
| `text-layout`               | Accessibilité | Info / Warning   | Texte justifié (I), interligne sous 1 (W), plus de 200 caractères centrés (une info pour tout l'email)                                                                      |
| `indistinct-links`          | Accessibilité | Info             | Lien dans une phrase, ni souligné ni d'une autre couleur                                                                                                                    |
| `headings`                  | Accessibilité | Info             | Titre vide, niveau sauté                                                                                                                                                    |
| `alt-redundant`             | Accessibilité | Info             | Texte alternatif identique au texte voisin                                                                                                                                  |
| `emoji-placement`           | Accessibilité | Info             | Deux emojis d'affilée ou plus, emoji au milieu d'une phrase (un emoji composé compte pour un)                                                                               |
| `tracking-params`           | Contenu       | Erreur, bloquant | Paramètres de tracking obligatoires sans valeur. Bloque le téléchargement et l'envoi ESP (`checkRequiredTrackingParams`)                                                    |
| `unfilled-links`            | Contenu       | Erreur           | Lien avec texte dont l'adresse est `#toreplace`, `#`, vide ou `javascript:`                                                                                                 |
| `malformed-links`           | Contenu       | Warning          | Protocole manquant ou inconnu, `mailto:` ou `tel:` invalide, espace, domaine sans point                                                                                     |
| `displayed-urls`            | Contenu       | Warning          | Le texte du lien est une adresse                                                                                                                                            |
| `suspicious-links`          | Contenu       | Warning          | Identifiant dans l'URL, adresse IP, environnement de test, domaine d'exemple, raccourcisseur, extension à risque, punycode                                                  |
| `images-without-link`       | Contenu       | Warning          | Image dans un lien non renseigné (un `data-ko-link` vide n'est pas exporté, donc pas signalé)                                                                               |
| `unnamed-image-links`       | Accessibilité | Warning          | Lien sans texte fait d'images sans alt                                                                                                                                      |
| `unreplaced-images`         | Contenu       | Erreur / Warning | Image sans `src` ou placeholder (E), image d'exemple du template (W)                                                                                                        |
| `alt-text-quality`          | Technique     | Info             | Alt qui est une adresse, un nom de fichier, ou de plus de 150 caractères                                                                                                    |
| `background-images`         | Contenu       | Warning          | Variante de fond activée sans image                                                                                                                                         |
| `unsupported-image-formats` | Technique     | Warning          | webp, avif, heic, heif, tif, tiff, svg                                                                                                                                      |
| `image-only-email`          | Accessibilité | Warning          | Des images et moins de 100 caractères de texte                                                                                                                              |
| `insecure-urls`             | Contenu       | Info / Warning   | Lien (I) ou image (W) en `http://`                                                                                                                                          |
| `forbidden-code`            | Technique     | Erreur           | script, iframe, form, embed, object, attributs `on…`, `javascript:` dans le code du client                                                                                  |
| `malformed-html`            | Technique     | Warning          | Balise jamais fermée ou fermante orpheline, dans un bloc de code HTML                                                                                                       |
| `unsupported-code`          | Technique     | Warning          | flex, grid, `position`, variables CSS, `@import`, images `data:`, `<svg>`, `<video>`, `<audio>`                                                                             |
| `loose-code`                | Technique     | Warning          | URL relative, couleur hexadécimale invalide, dans un bloc de code HTML                                                                                                      |
| `html-size`                 | Technique     | Warning          | HTML exporté de plus de 100 KB (Gmail tronque à 102 KB, l'ESP ajoute son tracking)                                                                                          |
| `broken-links`              | Contenu       | Erreur / Info    | Serveur. 404, 410, 500 ou domaine inexistant (E) ; délai, refus de robot (I « vérifiez-le »)                                                                                |
| `dangerous-links`           | Contenu       | Erreur           | Serveur. Google Web Risk : hameçonnage, logiciel malveillant ou indésirable. Désactivé sans `QC_WEB_RISK_API_KEY`                                                           |
| `domain-blocklists`         | Contenu       | Warning          | Serveur. Listes DNS de domaines. Désactivé sans `QC_DOMAIN_BLOCKLISTS`                                                                                                      |
| `image-weight`              | Performance   | Warning          | Serveur. Image de plus de 500 KB, GIF de plus de 1 MB, image introuvable, telles que l'export les livre                                                                     |
| `images-total-weight`       | Performance   | Warning / Erreur | Serveur. Poids total des images au-delà de 500 KB (W) ou de 1 MB (E)                                                                                                        |
| `oversized-images`          | Performance   | Info             | Serveur. Largeur réelle de plus de 2 fois l'attribut `width`                                                                                                                |

« Pas d'image de fond » est défini à un seul endroit, `quality/ownership.js` (`isImageUnset`). Le widget d'image de fond l'utilise aussi : le placeholder d'un client, codé en dur, a disparu. La syntaxe des variables de personnalisation des ESP est définie à un seul endroit, `quality/merge-tag-syntax.js`, et l'emoji dans `quality/emoji.js`.

### Affichage

Le panneau « Tester votre email » (`vue/components/quality-drawer/`) remplace la bannière du lot 1. Il groupe les résultats par sévérité (erreurs, warnings, infos, réussis), et chaque résultat propose « Aller au bloc », « Ajouter un commentaire » (pré-rempli, rien n'est publié sans l'utilisateur) et « Ignorer ». Un résultat ignoré est enregistré sur le mailing par son empreinte (`PATCH /api/mailings/:mailingId/quality-ignores`) et revient si son contenu change. Le téléchargement et l'envoi ESP lancent le contrôle et ouvrent le panneau ; seul le tracking obligatoire bloque, par la modale de `displayTrackingError()`. L'onglet « Envoi de test » du panneau envoie un test et crée les liens de partage.

### Contrôles qualité côté serveur

- **`POST /api/mailings/:mailingId/quality/resources`** (`quality-resources.service.js`) : l'éditeur envoie les liens et les images des blocs du client, le serveur répond pour chacun, sans rien enregistrer. Corps JSON obligatoire. Protection SSRF à chaque redirection, ports 80 et 443 seulement, 60 liens et 40 images, une échéance de 20 s et un budget de 50 MB par passage, un passage à la fois et 20 par tranche de 10 minutes par utilisateur, 16 sondes de liens et 8 téléchargements d'images simultanés pour le processus, cache de 10 minutes par entreprise. Les limites valent par worker.
- **Web Risk** (`quality-web-risk.service.js`) : clé dans l'en-tête `X-Goog-Api-Key`, adresses comparées sans leur query string, 3 000 consultations par jour et par entreprise au-delà du cache.
- **Lien de partage** (`share-link/`) : `GET /share/:token` sert la dernière version enregistrée, nettoyée (`sanitizeSharedPreviewHtml`, chaque lien en nouvel onglet sans `opener`), dans une iframe sandbox sous une CSP sans script. Jeton de 32 octets, retrouvé par son empreinte et conservé chiffré pour être recopié.

| Variable               | Effet                                                       | Par défaut |
| ---------------------- | ----------------------------------------------------------- | ---------- |
| `QC_WEB_RISK_API_KEY`  | Active `dangerous-links` (clé d'un projet Google Cloud)     | Désactivé  |
| `QC_DOMAIN_BLOCKLISTS` | Active `domain-blocklists`, au format `Nom=zone,Nom2=zone2` | Désactivé  |
| `ENCRYPTION_KEY`       | Chiffre le jeton des liens de partage, pour les recopier    | Existante  |

---

## Contrôles côté serveur

### A. Validations métier (mailing.service.js)

#### Validation d'existence

| Fonction                         | Quand          | Erreur              |
| -------------------------------- | -------------- | ------------------- |
| `validateMailExist(mailingId)`   | Download, Send | `MAILING_NOT_FOUND` |
| `checkCreationPayload(mailings)` | Création bulk  | `BadRequest`        |

#### Validation d'accès

| Fonction                                    | Quand           | Erreur                 |
| ------------------------------------------- | --------------- | ---------------------- |
| `checkAccessMailingsSource(mailings, user)` | Opérations bulk | `FORBIDDEN`            |
| Vérification workspace/folder               | Création        | `TWO_PARENTS_PROVIDED` |

#### Validation FTP/SSH

**Fonction** : `extractFTPparams()`

| Validation                            | Erreur retournée                  |
| ------------------------------------- | --------------------------------- |
| Config FTP absente                    | `FTP_NOT_DEFINED_FOR_GROUP`       |
| Clé SSH manquante (mode SSH)          | `FTP_MISSING_SSH_KEY`             |
| Mot de passe manquant (mode password) | `FTP_CONNECTION_AUTH_FAILED`      |
| Host introuvable                      | `FTP_CONNECTION_HOST_NOT_FOUND`   |
| Connexion refusée                     | `FTP_CONNECTION_REFUSED`          |
| Clé SSH invalide                      | `FTP_CONNECTION_INVALID_KEY`      |
| Timeout                               | `FTP_CONNECTION_TIMEOUT`          |
| Échec handshake                       | `FTP_CONNECTION_HANDSHAKE_FAILED` |
| Chemin introuvable                    | `FTP_PATH_NOT_FOUND`              |

### B. Processing HTML (process-mosaico-html-render.js)

Pipeline de traitement appliqué à tout HTML exporté :

| Étape | Fonction                    | Description                        |
| ----- | --------------------------- | ---------------------------------- |
| 1     | `removeTinyMceExtraBrTag()` | Supprime `<br data-mce-bogus="1">` |
| 2     | `replaceTabs()`             | Convertit tabs en espaces          |
| 3     | `secureHtml()`              | Encode en HTML entities            |
| 4     | `decodeSrcTags()`           | Décode attributs `src`             |
| 5     | `decodeHrefTags()`          | Décode attributs `href`            |

### C. Validation des images (mailing.service.js)

**Fonction** : `handleRelativeOrFtpImages()`

| Validation           | Comportement en cas d'échec |
| -------------------- | --------------------------- |
| URL valide (regex)   | Image ignorée               |
| HTTP status 200      | Image exclue de l'archive   |
| Dé-duplication (Set) | Une seule copie par image   |

**Regex d'extraction** : `/https?:\S+\.(jpg|jpeg|png|gif|webp)/g`

**Exclusions** :

- Images data-raw (data URIs inline)
- Images déjà traitées

### D. Validation des emails (send-test-mail.service.js)

**Fonction** : `sendTestMail()`

| Validation       | Librairie               | Comportement                |
| ---------------- | ----------------------- | --------------------------- |
| Format email     | `validator/lib/isEmail` | `BadRequest` si invalide    |
| Dé-duplication   | `onlyUnique` filter     | Supprime doublons           |
| Envoi individuel | -                       | Continue si un email échoue |

### E. Validation des profils ESP (profile.service.js)

| Fonction                                   | Description              | Erreur                         |
| ------------------------------------------ | ------------------------ | ------------------------------ |
| `checkIfUserIsAuthorizedToAccessProfile()` | Vérifie droits d'accès   | `FORBIDDEN_PROFILE_ACCESS`     |
| `checkIfProfileExiste()`                   | Vérifie existence profil | `PROFILE_NOT_FOUND`            |
| `checkIfMailAlreadySentToProfile()`        | Évite envois dupliqués   | `MAIL_ALREADY_SENT_TO_PROFILE` |

### F. Validation du modèle de données (checkmodel.js)

**Fonction** : Validation récursive de la structure du modèle

| Niveau | Signification                      |
| ------ | ---------------------------------- |
| 0      | Modèle valide                      |
| 1      | Compatible (anciennes versions)    |
| 2      | Incompatible (nécessite migration) |

---

## Tableau récapitulatif

### Contrôles par moment d'exécution

| Moment          | Contrôle                    | Type    | Sévérité | Bloquant |
| --------------- | --------------------------- | ------- | -------- | -------- |
| **Clic Export** | Tracking obligatoire        | Client  | Erreur   | Oui      |
| **Clic Export** | Liens non renseignés        | Client  | Erreur   | Non      |
| **Clic Export** | Images non remplacées       | Client  | Erreur   | Non      |
| **Clic Export** | Images cliquables sans lien | Client  | Warning  | Non      |
| **Clic Export** | Images de fond manquantes   | Client  | Warning  | Non      |
| **Clic Export** | Taille email (100KB)        | Client  | Warning  | Non      |
| **Download**    | Mailing existe              | Serveur | Critical | Oui      |
| **Download**    | Accès utilisateur           | Serveur | Critical | Oui      |
| **Download**    | Processing HTML             | Serveur | -        | Auto     |
| **Download**    | Images HTTP 200             | Serveur | Warning  | Non      |
| **FTP Upload**  | Config FTP                  | Serveur | Critical | Oui      |
| **FTP Upload**  | Connexion FTP               | Serveur | Critical | Oui      |
| **Send Test**   | Format email                | Serveur | Critical | Oui      |
| **Send ESP**    | Accès profil                | Serveur | Critical | Oui      |
| **Send ESP**    | Profil existe               | Serveur | Critical | Oui      |
| **Send ESP**    | Envoi dupliqué              | Serveur | Critical | Oui      |

### Codes d'erreur par catégorie

#### Mailing

| Code                       | Description                 |
| -------------------------- | --------------------------- |
| `MAILING_NOT_FOUND`        | Mailing introuvable         |
| `MAILING_MISSING_SOURCE`   | Source du mailing manquante |
| `MAILING_HTML_MISSING`     | HTML du mailing absent      |
| `FAILED_MAILING_COPY`      | Échec de copie              |
| `FAILED_MAILING_MOVE`      | Échec de déplacement        |
| `FAILED_MAILING_DELETE`    | Échec de suppression        |
| `FORBIDDEN_MAILING_COPY`   | Copie non autorisée         |
| `FORBIDDEN_MAILING_DELETE` | Suppression non autorisée   |

#### FTP/SSH

| Code                              | Description                |
| --------------------------------- | -------------------------- |
| `FTP_NOT_DEFINED_FOR_GROUP`       | Configuration FTP absente  |
| `FTP_MISSING_SSH_KEY`             | Clé SSH manquante          |
| `FTP_CONNECTION_AUTH_FAILED`      | Échec authentification     |
| `FTP_CONNECTION_HOST_NOT_FOUND`   | Host introuvable           |
| `FTP_CONNECTION_REFUSED`          | Connexion refusée          |
| `FTP_CONNECTION_INVALID_KEY`      | Clé SSH invalide           |
| `FTP_CONNECTION_TIMEOUT`          | Timeout connexion          |
| `FTP_CONNECTION_HANDSHAKE_FAILED` | Échec handshake            |
| `FTP_PATH_NOT_FOUND`              | Chemin distant introuvable |
| `INVALID_SSH_KEY_FORMAT`          | Format clé SSH invalide    |
| `INCOMPLETE_SSH_KEY`              | Clé SSH incomplète         |

#### Profil/ESP

| Code                                | Description                   |
| ----------------------------------- | ----------------------------- |
| `PROFILE_NOT_FOUND`                 | Profil introuvable            |
| `PROFILE_NAME_ALREADY_EXIST`        | Nom de profil déjà utilisé    |
| `FORBIDDEN_PROFILE_ACCESS`          | Accès profil non autorisé     |
| `MAIL_ALREADY_SENT_TO_PROFILE`      | Email déjà envoyé à ce profil |
| `UNAUTHORIZED_ESP`                  | ESP non autorisé              |
| `ESP_PROVIDER_INSTANCE_NOT_DEFINED` | Provider ESP non défini       |

---

## Opportunités d'amélioration

### 1. Contrôles manquants identifiés

Le QC v2 livre ceux-ci, sauf l'alt d'une image sans lien (une image décorative doit garder un alt vide : laissé à l'IA) et les balises sémantiques (propres au template).

| Contrôle                      | Priorité | Description                                          |
| ----------------------------- | -------- | ---------------------------------------------------- |
| **Alt text images**           | Haute    | Vérifier que toutes les images ont un attribut `alt` |
| **Liens cassés**              | Haute    | Vérifier que les URLs sont accessibles (HTTP HEAD)   |
| **Texte de prévisualisation** | Moyenne  | Vérifier présence et longueur du preheader           |
| **Ratio texte/image**         | Moyenne  | Éviter les emails "tout image" (spam filters)        |
| **Poids total images**        | Moyenne  | Seuil recommandé : 1 MB max                          |
| **Contraste couleurs**        | Basse    | Vérifier l'accessibilité des contrastes              |
| **Balises sémantiques**       | Basse    | Présence de `<title>`, structure heading             |

### 2. Améliorations UX

| Amélioration              | Description                                                       |
| ------------------------- | ----------------------------------------------------------------- |
| **Rapport détaillé**      | Générer un rapport PDF/HTML avec tous les contrôles               |
| **Contrôle préventif**    | Afficher les warnings pendant l'édition, pas seulement à l'export |
| **Sévérité configurable** | Permettre de rendre certains warnings bloquants                   |
| **Historique QC**         | Sauvegarder les résultats des contrôles qualité                   |

### 3. Contrôles techniques avancés

| Contrôle                      | Description                           |
| ----------------------------- | ------------------------------------- |
| **Validation W3C**            | Soumettre le HTML au validateur W3C   |
| **Test Litmus/Email on Acid** | Intégration avec services de preview  |
| **Spam score**                | Calculer un score spam (SpamAssassin) |
| **DKIM/SPF preview**          | Vérifier la config d'envoi            |

---

## Annexe : Points d'intégration

### Où le QC est appelé

```javascript
// Téléchargement : packages/editor/src/js/ext/badsender-server-storage.js
if (viewModel.quality) viewModel.quality.review({ html });

// Envoi ESP : packages/editor/src/js/vue/components/esp/esp-send-mail.js
if (this.vm.quality) this.vm.quality.review({ html: unprocessedHtml });

// Panneau : packages/editor/src/js/vue/components/quality-drawer/
this.vm.quality.run();
```

### Structure d'un résultat

```javascript
// runQualityChecks(viewModel, { html })
{
  findings: [
    {
      ruleId: 'unfilled-links',
      category: 'content',
      severity: 'error',
      messageKey: 'Link not filled in: __label__',
      params: { label: 'Cliquez ici' },
      blockId: 'ko_textBlock_3',
      blockLabel: 'Text #2',
      propertyPath: null,
      fingerprint: 'unfilled-links|ko_textBlock_3|-|1x2y3z|1',
    },
  ],
  // Une entrée par règle : 'passed', 'failed' (avec count) ou 'error'
  checks: [
    {
      ruleId: 'unfilled-links',
      category: 'content',
      titleKey: 'Links',
      status: 'failed',
      count: 1,
    },
  ],
  // Le HTML jugé, et ce que les règles distantes demandent au serveur
  html: '<!DOCTYPE html>…',
  resources: { links: ['https://…'], images: [{ url: 'https://…' }] },
}
```

---

_Document généré le 20 mars 2026_
