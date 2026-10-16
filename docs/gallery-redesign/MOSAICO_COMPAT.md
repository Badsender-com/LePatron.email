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

**Depuis la V1 (US-01, US-02) :** chaque fichier porte aussi `label`, `source`, `externalMetadata`,
`uploadedAt`, `width` et `height`, et la route accepte `search`, `format` et `sortBy` (`date_desc`,
`date_asc`). Mosaico n'envoie aucun de ces paramètres ; sans eux, la réponse est la galerie entière.

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
Un fichier déposé sur la galerie passe par l'éditeur Konva **avant** d'être envoyé, pas après :
`cropImage` est une étape de la `processQueue` de blueimp, et c'est sa résolution qui déclenche
le POST (`data.process().done(() => data.submit())`). L'éditeur remplace le `File` dans la file
d'attente, et c'est ce `File`-là qui part. Un upload direct dans un bloc email, lui, est
redimensionné automatiquement sans passer par l'éditeur — la distinction est intentionnelle.

**Troisième entrée dans ce même tuyau (US-10) :** le bouton « modifier » d'une vignette, et le
crayon d'une image déjà posée dans l'email, ne parlent pas à Konva directement. Ils relisent les
octets stockés, en font un `File`, et le confient au même widget d'upload — qui ouvre l'éditeur
par la même étape `cropImage`. Le drapeau `editingExistingImage` est la seule chose qui distingue
ce cas d'un import : il fait lire au bouton d'enregistrement « Enregistrer comme nouveau fichier »,
parce que c'est ce qui se passe (voir `docs/adr/0006-editing-a-gallery-image-adds-a-copy.md`).
GIF et SVG ne passent jamais par l'éditeur, qui les aplatirait.

---

### 1.3 `DELETE /api/images/:imageName` — supprimer une image

Appelé via le bouton corbeille de la barre d'actions d'une vignette (US-08 ; c'était le ✕ en haut à gauche avant elle). Requête XHR uniquement (`req.xhr` vérifié côté serveur).

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

### 1.5 `PATCH /api/images/gallery/:mongoId/:imageName/label` — renommer (V1, US-11)

Route ajoutée par la V1, que Mosaico n'appelle pas : elle change le `label` d'une image, identifiée
par son nom technique, sans toucher au fichier ni aux 4 champs ci-dessus. Comme l'upload et la
suppression, elle exige la capacité `gallery.manage`.

---

## 2. Champs image utilisés côté Mosaico

| Champ          | Où utilisé                                                                                                 | Criticité                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `thumbnailUrl` | Affichage vignette, drag & drop                                                                            | **Critique** — absent = image invisible      |
| `name`         | Déduplication à l'upload (`file.name === imageName`)                                                       | **Critique** — modifié = doublons en galerie |
| `url`          | Passé dans `remoteUrlProcessor` (identité par défaut), puis utilisé lors du drag & drop vers un bloc email | **Critique**                                 |
| `deleteUrl`    | Bouton de suppression de la vignette (`ext/badsender-remove-gallery-image.js`)                             | Moyen                                        |

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
4. **Ne pas modifier le comportement de Mosaico** (bindings d'origine, convertisseur, modèle) :
   l'UI de la galerie s'ajoute par les points d'extension de l'éditeur (`src/js/vue/`,
   `src/js/ext/badsender-*`, `src/js/bindings/badsender-*`, `tmpl-badsender/`), et un plugin
   s'enregistre dans le tableau `extensions` de `src/js/app.js`
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

_Rédigé pour le spike US-00 (juin 2026), complété en octobre 2026 avec ce que la V1 a construit (US-08, US-10, US-11)._
