# Analyse du Contrôle Qualité à l'Export

> **Objectif** : Documenter exhaustivement les contrôles qualité existants lors de l'export d'un template/mailing dans LePatron.email.
>
> **Date** : 20 mars 2026
> **Branche** : `feat/quality-control`

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
│  2. getErrorsForControlQuality() → Vérifie taille, liens, images │
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

| Fichier                                                      | Rôle                       | Couche  |
| ------------------------------------------------------------ | -------------------------- | ------- |
| `packages/editor/src/js/ext/badsender-control-quality.js`    | Contrôle qualité principal | Client  |
| `packages/editor/src/js/ext/badsender-server-storage.js`     | Intégration QC à l'export  | Client  |
| `packages/editor/src/js/vue/components/esp/esp-send-mail.js` | QC avant envoi ESP         | Client  |
| `packages/server/mailing/mailing.service.js`                 | Validations métier         | Serveur |
| `packages/server/mailing/download-zip.controller.js`         | Export ZIP                 | Serveur |
| `packages/server/mailing/send-test-mail.service.js`          | Validation emails test     | Serveur |
| `packages/server/profile/profile.service.js`                 | Validation profils ESP     | Serveur |
| `packages/server/utils/process-mosaico-html-render.js`       | Processing HTML            | Serveur |
| `packages/server/utils/download-zip-markdown.js`             | Notices export             | Serveur |
| `packages/editor/src/js/converter/checkmodel.js`             | Validation modèle données  | Client  |

---

## Contrôles côté client (Editor)

### Fichier principal : `badsender-control-quality.js`

Le contrôle qualité client est déclenché via la fonction `getErrorsForControlQuality(viewModel)` appelée lors de :

- L'export d'un mailing (download)
- L'envoi vers un ESP

#### 1. Contrôle de la taille de l'email

**Fonction** : `checkAndDisplaySizeWarning(viewModel)`

| Paramètre | Valeur                                 |
| --------- | -------------------------------------- |
| Seuil     | 102 KB                                 |
| Risque    | Clipping Gmail (troncature du contenu) |
| Sévérité  | Warning                                |

**Comportement** :

- Génère le HTML exporté en blob
- Compare la taille au seuil de 102 KB
- Affiche un avertissement si dépassé

**Message affiché** :

> "The exported HTML exceeds 102KB, which may result in clipping email on Gmail"

#### 2. Contrôle des images de fond manquantes

**Fonction** : Intégrée dans `getErrorsForControlQuality()`

**Types d'images vérifiées** :

| Type     | Condition de vérification                                     | Champ vérifié    |
| -------- | ------------------------------------------------------------- | ---------------- |
| Outlook  | `outlookBgImageVisible() === true`                            | `outlookBgImage` |
| Mobile   | `mobileBgImageChoice() === 'mobile'`                          | `mobileBgimage`  |
| Standard | `bgImageChoice() === 'custom'` OU `bgImageVisible() === true` | `bgimage`        |

**Détection d'image vide** (`isElementEmpty()`) :

- `null` ou chaîne vide
- Valeur `'none'`
- GIF transparent 1x1 : `data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==`
- Placeholder : `https://live.lepatron.email/clarins/mastertemplate/bg.png`

#### 3. Contrôle des liens incomplets

**Fonction** : Intégrée dans `getErrorsForControlQuality()`

**Sélecteur CSS** : `a[href="#toreplace"]`

**Erreurs détectées** :

| Condition                   | Message d'erreur                        |
| --------------------------- | --------------------------------------- |
| Lien avec href="#toreplace" | `"Missing link label: [texte du lien]"` |
| Image sans lien             | `"Picture with no link"`                |

#### 4. Affichage des erreurs

**Fonction** : `displayErrors(errors, viewModel)`

**Format d'affichage** :

- Message de succès : "Your email was successfully exported"
- Liste ordonnée des problèmes détectés
- Dialog modal bloquant (notification utilisateur)

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

| Moment          | Contrôle                  | Type    | Sévérité | Bloquant |
| --------------- | ------------------------- | ------- | -------- | -------- |
| **Clic Export** | Taille email (102KB)      | Client  | Warning  | Non      |
| **Clic Export** | Images de fond manquantes | Client  | Warning  | Non      |
| **Clic Export** | Liens incomplets          | Client  | Warning  | Non      |
| **Clic Export** | Images sans lien          | Client  | Warning  | Non      |
| **Download**    | Mailing existe            | Serveur | Critical | Oui      |
| **Download**    | Accès utilisateur         | Serveur | Critical | Oui      |
| **Download**    | Processing HTML           | Serveur | -        | Auto     |
| **Download**    | Images HTTP 200           | Serveur | Warning  | Non      |
| **FTP Upload**  | Config FTP                | Serveur | Critical | Oui      |
| **FTP Upload**  | Connexion FTP             | Serveur | Critical | Oui      |
| **Send Test**   | Format email              | Serveur | Critical | Oui      |
| **Send ESP**    | Accès profil              | Serveur | Critical | Oui      |
| **Send ESP**    | Profil existe             | Serveur | Critical | Oui      |
| **Send ESP**    | Envoi dupliqué            | Serveur | Critical | Oui      |

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
// Export mailing
// packages/editor/src/js/ext/badsender-server-storage.js:95
const errors = getErrorsForControlQuality(viewModel);

// Envoi ESP
// packages/editor/src/js/vue/components/esp/esp-send-mail.js:224
const errors = getErrorsForControlQuality(this.vm);
```

### Structure du rapport d'erreurs

```javascript
// Retour de getErrorsForControlQuality()
{
  errors: [
    'Missing link label: Cliquez ici',
    'Picture with no link',
    'The exported HTML exceeds 102KB...',
  ];
}
```

---

_Document généré le 20 mars 2026_
