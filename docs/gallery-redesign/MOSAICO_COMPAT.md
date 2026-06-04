# Contraintes de compatibilité Mosaico — Galerie d'images

> Livrable du spike US-00.
> Ce document liste tout ce que Mosaico consomme côté images, afin de garantir
> une compatibilité à 100 % lors de la refonte V1.

---

## 1. Endpoints consommés par Mosaico

### 1.1 `GET /api/images/gallery/:mongoId` — lister les images

Appelé automatiquement à deux moments :

- À l'ouverture de l'onglet **"Spécifique à l'email"** (premier accès)
- À l'ouverture de l'onglet **"Commun au template"** (premier accès)

**Format de réponse attendu :**

```json
{
  "files": [
    {
      "name": "abc123def456-a1b2c3d4.jpg",
      "url": "abc123def456-a1b2c3d4.jpg",
      "deleteUrl": "/api/images/abc123def456-a1b2c3d4.jpg",
      "thumbnailUrl": "/api/images/cover/111x111/abc123def456-a1b2c3d4.jpg"
    }
  ]
}
```

**Contrainte absolue :** les 4 champs `name`, `url`, `deleteUrl`, `thumbnailUrl` doivent toujours
être présents. Des champs supplémentaires (ex: `label`) peuvent être ajoutés sans risque —
Mosaico les ignore.

---

### 1.2 `POST /api/images/gallery/:mongoId` — uploader une image

Appelé via le composant jQuery File Upload intégré à Mosaico (binding `fileupload`).

**Format de réponse attendu :**

```json
{
  "files": [
    {
      "name": "abc123def456-a1b2c3d4.jpg",
      "url": "abc123def456-a1b2c3d4.jpg",
      "deleteUrl": "/api/images/abc123def456-a1b2c3d4.jpg",
      "thumbnailUrl": "/api/images/cover/111x111/abc123def456-a1b2c3d4.jpg"
    }
  ]
}
```

**Important :** la réponse ne contient que les fichiers _nouvellement uploadés_, pas toute la
galerie. Mosaico ajoute ces fichiers à son observable local.

**Comportement critique à préserver :**
À la fin de l'upload dans la galerie, Mosaico lance automatiquement l'éditeur Konva
(comportement intentionnel, distinct de l'upload direct dans un bloc email).

---

### 1.3 `DELETE /api/images/:imageName` — supprimer une image

Appelé via le bouton ✕ dans la galerie Mosaico. Requête XHR uniquement (`req.xhr` vérifié côté serveur).

**Réponse attendue :**

```json
{ "files": [...] }
```

Le tableau `files` retourné est la galerie après suppression. Mosaico met à jour son
observable local en conséquence.

**Comportement actuel :** la suppression retire l'image du tableau `files` en base. Elle n'est
pas supprimée du stockage fichier (FS ou S3). Ce comportement est **intentionnel et à préserver**.

---

### 1.4 `GET /api/images/cover/:sizes/:imageName` — thumbnail à la volée

URL construite automatiquement par le helper `format-filename-for-jquery-fileupload.js`
avec la taille fixe `111x111`.

```
/api/images/cover/111x111/{imageName}
```

Mosaico utilise cette URL comme `background-image` CSS et comme `src` du tag `<img>` dans
la galerie. **Le format `111x111` est hardcodé dans le helper.**

---

## 2. Champs image utilisés côté Mosaico

| Champ          | Où utilisé                                                                                                 | Criticité                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `thumbnailUrl` | Affichage vignette, drag & drop                                                                            | **Critique** — absent = image invisible      |
| `name`         | Déduplication à l'upload (`file.name === imageName`)                                                       | **Critique** — modifié = doublons en galerie |
| `url`          | Passé dans `remoteUrlProcessor` (identité par défaut), puis utilisé lors du drag & drop vers un bloc email | **Critique**                                 |
| `deleteUrl`    | Bouton de suppression (non visible dans le template Badsender actuel, mais présent dans la logique)        | Moyen                                        |

**Champs ignorés par Mosaico :** tout champ supplémentaire dans l'objet fichier (`label`,
`source`, `externalMetadata`, etc.) est préservé par `remoteFileProcessor` mais non utilisé.
Il est donc **safe d'ajouter des champs** dans la réponse API.

---

## 3. Architecture interne à connaître

### 3.1 Le modèle de données actuel

Les images ne sont **pas** des documents MongoDB individuels.
Elles sont stockées dans un tableau `files` au sein d'un document `Gallery` unique par email/template.

```
Collection: galleries
Document:
  creationOrWireframeId: ObjectId  ← identifiant de l'email ou du template
  files: [
    { name, url, deleteUrl, thumbnailUrl },
    { name, url, deleteUrl, thumbnailUrl },
    ...
  ]
```

**Conséquence pour US-01 :** ajouter `label` signifie ajouter ce champ dans chaque objet
du tableau `files`, pas créer un nouveau modèle.

### 3.2 Le getter Mongoose

Le schéma `gallery.schema.js` définit un **getter** sur le champ `files` :

```js
get: (files) =>
  files.map((file) => formatFilenameForJqueryFileupload(file.name));
```

Ce getter est appliqué lors de `toJSON()` (donc lors de `res.json(gallery)`).
Il reconstruit les 4 champs à partir de `file.name` **uniquement** — il ignore
tout autre champ stocké.

**Impact pour US-01 :** pour que `label` soit exposé dans l'API, il faudra modifier ce getter
pour inclure `label` (et les autres nouveaux champs) dans la réponse. Les endpoints Mosaico
ne seront pas affectés car Mosaico ignore les champs inconnus.

### 3.3 Le nom de fichier technique

À l'upload, le nom de fichier est transformé en :

```
{mongoId}-{md5hash}.{ext}
```

Exemple : `63e1a2b3c4d5e6f7a8b9c0d1-a1b2c3d4.jpg`

Le **nom de fichier original** de l'utilisateur (`logo final.png`) est converti en slug
(`logo-final.png`), utilisé en `originalName` dans formidable, puis **n'est pas conservé en base**.

**Conséquence pour US-01 et US-03 :**

- Pour les nouveaux uploads : capturer `file.originalName` et le stocker comme valeur initiale de `label`
- Pour les images existantes (migration) : `label` sera initialisé à partir du nom technique (le hash) — l'original est perdu

---

## 4. Contraintes à respecter pour toute modification (V1)

1. **Ne jamais modifier ni supprimer** les champs `name`, `url`, `deleteUrl`, `thumbnailUrl`
   dans la réponse des endpoints `/gallery/:mongoId`
2. **Ne jamais changer** le format du nom de fichier technique (`{mongoId}-{hash}.{ext}`)
   — c'est la clé d'identification d'une image dans toute la chaîne
3. **Ne jamais modifier** la taille `111x111` dans `format-filename-for-jquery-fileupload.js`
   sans adapter partout où cette URL est consommée
4. **Ne pas toucher** au code dans `packages/editor/` (Mosaico) — toute évolution
   doit rester côté `packages/server/` et `packages/ui/`
5. La vérification `req.xhr` sur le DELETE doit être maintenue

---

## 5. Impact sur US-01 — Modèle de données

| Point                                 | Décision                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Architecture tableau                  | À conserver pour V1. Migration vers documents individuels = risque élevé, bénéfice limité à cette échelle.                          |
| Ajout de `label`                      | Faisable dans le tableau. Modifier le getter pour l'exposer. Capturer `originalName` à l'upload.                                    |
| Ajout de `source`, `externalMetadata` | Identique : champs supplémentaires dans l'objet du tableau.                                                                         |
| PATCH renommage                       | Identifier l'image par `file.name` (clé technique), mettre à jour `label`. Pattern identique à `destroy`.                           |
| Migration existant                    | `label` initialisé au nom technique (hash) — acceptable, l'utilisateur pourra renommer.                                             |
| Endpoints Mosaico                     | Aucune modification. Les nouveaux champs apparaissent dans la réponse (inoffensif) ou sont servis par de nouveaux endpoints dédiés. |

---

_Rédigé dans le cadre du spike US-00 — juin 2026._
