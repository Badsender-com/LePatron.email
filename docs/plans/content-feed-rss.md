# Flux de contenu RSS — Import d'items dans les blocs de template

> **Branche** : `feat/content-feed-rss` (n'existe que sur cette branche, non mergée)
> **Type de document** : plan rétrospectif (rédigé _a posteriori_, le code est déjà implémenté mais pas encore intégré)
> **Commits** : `f3f1d284` → `5b03cad1` (5 commits)
> **Statut** : implémenté sur la branche dédiée, **pas encore passé par une PR**. Ces 5 commits avaient été poussés par erreur directement sur `staging` (tracking local mal configuré) puis retirés via un revert (`d9644495`, 2026-07-07) en attendant une vraie PR vers `develop`. POC scopé à un client (voir §7 Limites).

---

## 1. Objectif

Permettre à un groupe (client) de brancher un **flux RSS/Atom externe** comme source de contenu, puis d'injecter des items de ce flux directement dans les blocs d'un template pendant l'édition d'un mailing — sans copier-coller manuel de titre/lien/image/description.

### Parcours utilisateur

**1. Admin de groupe (ou super-admin) — configuration**

1. Déclare une intégration de type `data_feed` / provider `rss` dans _Réglages du groupe > Intégrations_, en renseignant uniquement l'URL du flux (`apiHost`). Pas de clé API requise pour ce type de provider.
2. Configure un **flux de contenu** dans _Réglages du groupe > Flux de contenu_ (nouvel écran) :
   - choisit un template,
   - choisit un bloc de ce template (ex. `articlesBlock`),
   - choisit le nombre de colonnes (1 à 4, pour les blocs multi-colonnes),
   - définit, pour chaque colonne, un mapping libre `champ du bloc → propriété du flux` (title / link / description / image / pubDate, ou un libellé CTA statique).

**2. Utilisateur éditant un mailing — usage**

1. Un badge RSS apparaît sur la miniature du bloc dans la toolbox si ce bloc a un mapping actif pour le template courant.
2. Une fois le bloc posé sur le canvas, un outil "Import from feed" apparaît dans sa barre d'outils.
3. Cet outil ouvre une modale qui liste les items du flux, permet une sélection multiple (bornée au nombre de colonnes pour un bloc multi-colonnes) et le réordonnancement par drag-and-drop.
4. À la validation, le(s) bloc(s) sont remplis automatiquement (texte, lien, image téléchargée et re-hébergée dans la galerie du mailing).

> Le message du commit `f3f1d284` précise explicitement : _"POC scoped to group 'Badsender test' / template 'Démo' / articlesBlock"_. Le code a été généralisé (mapping multi-colonnes, détection de champs `-ko-attr-*`) mais n'a été exercé en pratique que sur ce cas précis.

---

## 2. Architecture et flux de données

```
┌──────────────────────────┐        ┌───────────────────────────────┐
│ Backoffice (Vue/Vuetify)  │        │ Éditeur mailing (Knockout+Vue) │
│                           │        │                                │
│ Réglages > Intégrations   │        │ Toolbox : badge RSS conditionnel│
│  → integration-form.vue   │        │  (isFeedMappableBlock)         │
│                           │        │           │                    │
│ Réglages > Flux de contenu│        │           ▼                    │
│  → feed-mappings-tab.vue  │        │ Bloc posé : outil              │
│  → feed-mapping-form-     │        │ "Import from feed"             │
│    dialog.vue             │        │           │                    │
│    (cascade template      │        │           ▼                    │
│     → blocs → champs)     │        │ ContentFeedModal (Vue)         │
└──────────┬────────────────┘        │  - fetchMappingsAndItems       │
           │                          │  - fillBlockColumns /          │
           ▼                          │    insertSeparateBlocks        │
  FeedMapping (Mongoose)              │  - resolveImageSrc             │
  {_company,_integration,             └───────────┬─────────────────┘
   _template, blockName,                          │
   fieldMapping[1..4], ctaDefaultLabel,           │ injectBlockTranslations
   isActive}                                      │ (utilitaire préexistant,
           │                                       │  navigation dot-notation +
           │ GET /feed-mappings?templateId=        │  unwrap/rewrap Knockout)
           ▼                                       ▼
  feed-mapping.service.js  ────────────►  Bloc Mosaico rempli
           │                                (data-ko-editable /
           │ _integration                    -ko-attr-href / -ko-attr-alt)
           ▼
  RssProvider.fetchItems()
   - fetch (node-fetch, timeout 15s)
   - assertOutboundHostAllowed (garde SSRF, TOCTOU-safe)
   - parse RSS 2.0 / Atom (fast-xml-parser)
   - normalise {title, link, description, image, pubDate}
           │
           │ image d'un item sélectionné
           ▼
  image.service.js#createFromUrl
   - re-vérifie assertOutboundHostAllowed (2e URL non fiable)
   - télécharge (max 10 Mo), hash MD5, écrit via fileManager
   - ajoute à la Gallery du mailing (dédoublonné)
```

### 2.1 Modèle `FeedMapping` (`packages/server/feed-mapping/feed-mapping.schema.js`)

| Champ             | Type                             | Notes                                                            |
| ----------------- | -------------------------------- | ---------------------------------------------------------------- |
| `_company`        | ObjectId → Group (alias `group`) | dérivé côté serveur, jamais reçu du client                       |
| `_integration`    | ObjectId → Integration           | source du flux                                                   |
| `_template`       | ObjectId → Template              | template ciblé                                                   |
| `blockName`       | String                           | nom du bloc Mosaico (`data-ko-block`)                            |
| `fieldMapping`    | `[Mixed]`, 1 à 4 entrées         | une entrée par colonne, map libre `{champ bloc: propriété flux}` |
| `ctaDefaultLabel` | String                           | libellé CTA statique par défaut                                  |
| `isActive`        | Boolean                          | défaut `true`                                                    |

Index composé `{_company, _template, blockName}` — **non unique** : plusieurs mappings peuvent coexister pour le même triplet.

### 2.2 API `feed-mapping` (service/controller/routes)

- `feed-mapping.service.js` : `create`, `update`, `deleteFeedMapping`, `findById`, `findAllByGroup`, `findActiveByTemplate`. `assertIntegrationInGroup`/`assertTemplateInGroup` vérifient l'appartenance groupe (sauf admin).
- Routes :
  - `GET /api/feed-mappings?templateId=` — `GUARD_USER` (tout éditeur de mailing doit découvrir les mappings actifs)
  - `GET /api/feed-mappings/groups/:groupId` — `GUARD_GROUP_ADMIN`
  - `POST/PUT/DELETE /api/feed-mappings` — `GUARD_GROUP_ADMIN`
- `feed-mapping.controller.js` : whitelist stricte des champs acceptés (`CREATE_FIELDS`/`UPDATE_FIELDS`) — anti-élévation, `_company` toujours dérivé côté serveur.

### 2.3 Provider RSS (`packages/server/integration-providers/data-feed/rss-provider.js`)

Étend `BaseProvider` préexistant. Dépendances déjà présentes avant la feature (`node-fetch`, `abort-controller`, `fast-xml-parser`) — aucune nouvelle dépendance ajoutée.

- `fetchItems({limit})` : relit l'`apiHost` de l'intégration, revalide l'hôte (`assertOutboundHostAllowed`, garde SSRF avec re-résolution DNS à chaque appel), parse RSS 2.0 (`rss.channel.item`) ou Atom (`feed.entry`), normalise, trie par date décroissante, tronque à `limit`.
- `validateCredentials()` réutilise `fetchItems({limit: 1})` — simple test de joignabilité (pas de vraie clé pour un flux public).
- Enregistré dans `provider-factory.js` (`PROVIDER_MAP[IntegrationProviders.RSS]`).

Nouvel endpoint : `GET /api/integrations/:integrationId/items?limit=` (`GUARD_USER`, limite bornée 1-50, défaut 10), protégé en interne par `checkIfUserIsAuthorizedToAccessIntegration` pour empêcher un utilisateur de lire les items d'une intégration d'un autre groupe.

### 2.4 Extension du modèle Integration

- `integration-type.js` : `DATA_FEED: 'data_feed'`
- `integration-provider.js` : `RSS: 'rss'`
- `integration.schema.js` : `apiKey` devient optionnel pour les providers `DATA_FEED` (un flux public n'a pas de clé)

### 2.5 Introspection des templates (`template-block-parser.js`, `template-blocks.controller.js`)

Deux endpoints (`GET /templates/:id/blocks`, `GET /templates/:id/blocks/:blockName/fields`, `GUARD_GROUP_ADMIN`) permettent à l'écran de config de lister dynamiquement les blocs/champs disponibles, sans que l'admin connaisse les noms de propriétés Mosaico internes.

`getBlockFieldPaths` scanne deux mécanismes de déclaration de champ :

- historique : attributs `data-ko-editable` / `data-ko-link` ;
- ajouté par le fix `9a9b9b4d` : pseudo-propriétés `-ko-attr-href` / `-ko-attr-alt` / `-ko-attr-src` embarquées dans l'attribut `style` (syntaxe LESS Mosaico), en excluant les expressions conditionnelles et les propriétés de layout (`width`, `padding`, `class`...).

### 2.6 Téléchargement d'image distante (`image.service.js#createFromUrl`)

Une image d'item RSS est une URL externe ; le proxy resize/cover existant ne sait servir que des fichiers déjà dans le storage de l'app. Nouveau endpoint `POST /api/images/gallery/:mongoId/from-url` (`GUARD_USER`) : télécharge (timeout 15s, max 10 Mo), revalide l'hôte (2ᵉ appel à `assertOutboundHostAllowed`, URL non fiable), hash MD5 pour nommer le fichier, écrit via `fileManager`, ajoute à la `Gallery` du mailing avec déduplication — même pipeline qu'un upload manuel.

### 2.7 UI backoffice (Vue/Vuetify)

- `feed-mappings-tab.vue` : table des mappings d'un groupe (template / bloc / intégration / actif), actions éditer/supprimer.
- `feed-mapping-form-dialog.vue` : formulaire avec cascade réactive template → blocs → champs, sélecteur de colonnes, tableau de mapping par colonne, libellé CTA, toggle actif. Watchers de repopulation (édition) et handlers d'interaction utilisateur volontairement séparés pour ne pas écraser une saisie en cours.
- `feed-mappings.vue` : route protégée par `meta.acl = [ACL_ADMIN, ACL_GROUP_ADMIN]`.
- `provider-configs.js` : nouvelle catégorie `contentFeed`, entrée `rss` (icône Lucide `Rss` dans `integrations-tab.vue` et la sidebar de réglages groupe).

### 2.8 Éditeur (Knockout + Vue)

- `badsender-content-feed-mappings.js` (extension Knockout) : au chargement/changement de mailing, interroge `/api/feed-mappings?templateId=`, alimente `viewModel.feedMappableBlockNames`, expose `viewModel.isFeedMappableBlock(blockData)`.
- `toolbox.tmpl.html` : badge RSS conditionnel sur la miniature de bloc.
- `block-wysiwyg.tmpl.html` : outil "Import from feed" dans la barre d'outils du bloc posé.
- `viewmodel.js` : `cloneBlockInstance` (clone via `ko.toJS`, id vidé), `openContentFeedModal`/`toggleContentFeedModal`. Fix connexe sur `addBlock` pour ne plus supposer que `blockInformation` est toujours une fonction.
- `content-feed-modal.js` (composant Vue monté par `customizedBlockPlugin.js`) :
  - `fetchMappingsAndItems` → mappings actifs + items du flux (`apis.js#getFeedItems`)
  - `fillBlockColumns` (bloc multi-colonnes) : remplit chaque colonne en place
  - `insertSeparateBlocks` (bloc mono-colonne) : 1er item en place, suivants clonés + insérés (`cloneBlockInstance` + `addBlock`)
  - `resolveImageSrc` : télécharge l'image via `apis.js#uploadGalleryImageFromUrl` (échec non bloquant — bloc rempli sans image)
  - Injection finale via `injectBlockTranslations` (`block-content-extractor.js`, utilitaire préexistant de la feature de traduction, réutilisé tel quel : navigation dot-notation + unwrap/rewrap d'observables Knockout)

### 2.9 CSS

- `lucide-icons.less` : icône `lucide-rss`.
- `style_mosaico_tools.less` : `.block-feed-badge` + styles de la modale (liste d'items, zone de drag-and-drop).

---

## 3. Historique des fixes post-implémentation

| Commit     | Problème                                                                                                    | Cause                                                                                                                                                                                   | Correction                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `7c646ab8` | Tooltips de la barre d'outils toujours en anglais                                                           | Les tooltips utilisent la convention "texte anglais = clé de traduction", mais aucune entrée n'avait été ajoutée dans `badsender-{en,fr}.js` → fallback silencieux sur la clé manquante | Ajout des entrées de traduction manquantes                                                                                                    |
| `060b60a8` | Badge de flux de contenu peu visible                                                                        | Badge trop petit (20px/icône 11px), pas de contraste sur miniatures sombres/colorées                                                                                                    | Badge 26px, icône 14px, `box-shadow` liseré blanc                                                                                             |
| `9a9b9b4d` | Champs lien/alt de certains templates (ex. Clarins) invisibles dans l'écran de mapping                      | `getBlockFieldPaths` ne scannait que `data-ko-editable`/`data-ko-link`, pas les pseudo-propriétés `-ko-attr-href`/`-ko-attr-alt` déclarées dans `style` (syntaxe LESS Mosaico)          | Ajout d'un scan `[style]` avec regex dédiée, limité aux champs de contenu (`href`/`alt`/`src`), 4 nouveaux tests                              |
| `5b03cad1` | Création d'un mapping impossible pour un super-admin (`Cannot read properties of undefined (reading 'id')`) | `create()` lisait directement `user.group.id` sans vérifier `user.isAdmin` ; un super-admin n'a pas de `group`                                                                          | `assertTemplateInGroup` retourne désormais le template validé ; `create()` en dérive `_company: template._company` au lieu de `user.group.id` |

---

## 4. Permissions et sécurité

| Route                                           | Guard                                                                  | Justification                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `POST/PUT/DELETE /feed-mappings`                | `GUARD_GROUP_ADMIN`                                                    | configuration réservée aux admins de groupe                    |
| `GET /feed-mappings/groups/:groupId`            | `GUARD_GROUP_ADMIN` + vérif d'accès au groupe                          | liste par groupe                                               |
| `GET /feed-mappings?templateId=`                | `GUARD_USER`                                                           | tout éditeur de mailing doit découvrir les mappings actifs     |
| `GET /integrations/:id/items`                   | `GUARD_USER` + `checkIfUserIsAuthorizedToAccessIntegration` en interne | empêche la lecture d'items d'une intégration d'un autre groupe |
| `GET /templates/:id/blocks[/:blockName/fields]` | `GUARD_GROUP_ADMIN`                                                    | introspection réservée à l'écran de config                     |
| `POST /images/gallery/:mongoId/from-url`        | `GUARD_USER`                                                           | téléchargement d'image tierce                                  |

**Défense en profondeur SSRF** : `assertOutboundHostAllowed` (préexistant) est réutilisé à deux endroits introduits par cette feature — `rss-provider.js#fetchItems` (URL du flux) et `image.service.js#createFromUrl` (URL de l'image d'un item) — avec re-résolution DNS à chaque appel (protection TOCTOU) et rejet des plages privées/loopback/link-local/metadata cloud.

**Anti-élévation** : `_company` n'est jamais accepté depuis le body des requêtes, toujours dérivé côté serveur du template/groupe validé.

---

## 5. Tests

`tests/server/template/template-block-parser.test.js` (nouveau fichier, commit `9a9b9b4d`) :

- `listBlockNames` : markup vide/null/undefined → `[]` ; dédoublonnage des noms de bloc.
- `getBlockFieldPaths` (cas de base) : markup/blockName manquants → `[]` ; collecte scopée au bon bloc (pas de fuite entre blocs).
- Cas `-ko-attr-*` : reproduit le cas réel Clarins (`columns_v2Block`) où `href`/`alt` sont déclarés dans `style`.
- Cas négatif : ignore les bindings de layout (`-ko-width`, `-ko-padding-left`, `-ko-attr-class`) et les valeurs littérales non-propriété.
- Cas d'isolation : un binding dans `otherBlock` ne doit pas fuiter dans les résultats du bloc ciblé.

`provider-factory.test.js` : ajustement pour compter le nouveau provider RSS dans `getSupportedProviders()`.

---

## 6. Constantes ajoutées

- `error-codes.js` : `FEED_ITEMS_FETCH_FAILED`, `FEED_MAPPING_NOT_FOUND`, `FEED_MAPPING_INVALID_INTEGRATION`, `FEED_MAPPING_INVALID_TEMPLATE`, `FAILED_FEED_MAPPING_DELETE`.
- `model.names.js` : `FeedMappingModel: 'FeedMapping'`.

---

## 7. Limites connues / dette technique

- **Aucun test sur la logique métier critique** : `feed-mapping.service.js` (autorisations groupe/admin — exactement la zone où le bug `5b03cad1` est apparu), `feed-mapping.controller.js`, `rss-provider.js` (parsing RSS/Atom, gestion d'erreurs), `image.service.js#createFromUrl`. Seul le parsing HTML des blocs est testé.
- **Pas de cache ni de rate-limiting** sur le fetch RSS : chaque ouverture de la modale déclenche un fetch live du flux distant, sans TTL ni déduplication de requêtes concurrentes.
- **`apiHostRequired` déclaré mais non branché** dans la validation `vuelidate` du formulaire d'intégration (seul `apiKeyRequired` l'est) : une intégration RSS peut être créée sans URL de flux ; l'erreur ne remonte qu'à l'ouverture de la modale côté éditeur.
- **Pas de validation du flux à la création de l'intégration** : rien n'appelle `validateCredentials()` systématiquement, pas de contrôle du `Content-Type` avant parsing XML.
- **`createFromUrl`** : la limite de 10 Mo est vérifiée après téléchargement complet en mémoire, pas en streaming via `Content-Length` — un flux malveillant sans header de taille consommerait de la mémoire avant rejet.
- **Couplage fort au scope POC initial** (groupe/template/bloc uniques testés en pratique) malgré une implémentation générique.
- **`fieldMapping` en `Schema.Types.Mixed` libre** : aucune validation de forme côté Mongoose ; la cohérence n'est garantie que par l'UI.
- **Pas de pagination** sur `GET /integrations/:id/items` : un flux à fort volume est retéléchargé et re-parsé intégralement à chaque appel.

---

## 8. Fichiers clés

**Serveur**

- `packages/server/feed-mapping/feed-mapping.{schema,service,controller,routes}.js`
- `packages/server/integration-providers/data-feed/rss-provider.js`
- `packages/server/integration-providers/provider-factory.js`
- `packages/server/utils/outbound-host.js` (réutilisé)
- `packages/server/template/template-block-parser.js`
- `packages/server/template/template-blocks.controller.js`
- `packages/server/image/image.{service,controller,routes}.js`
- `packages/server/integration/integration.{schema,controller,routes}.js`
- `packages/server/constant/{error-codes,integration-type,integration-provider,model.names}.js`

**UI backoffice**

- `packages/ui/components/group/feed-mappings-tab.vue`
- `packages/ui/components/group/feed-mapping-form-dialog.vue`
- `packages/ui/routes/groups/_groupId/settings/feed-mappings.vue`
- `packages/ui/components/integrations/provider-configs.js`

**Éditeur**

- `packages/editor/src/js/vue/components/content-feed-modal/content-feed-modal.js`
- `packages/editor/src/js/ext/badsender-content-feed-mappings.js`
- `packages/editor/src/js/viewmodel.js`
- `packages/editor/src/js/utils/block-content-extractor.js` (réutilisé)
- `packages/editor/src/js/vue/utils/apis.js`
- `packages/editor/src/tmpl-badsender/toolbox.tmpl.html`
- `packages/editor/src/tmpl/block-wysiwyg.tmpl.html`
- `packages/editor/src/css/{style_mosaico_tools,lucide-icons}.less`

**Tests**

- `tests/server/template/template-block-parser.test.js`
