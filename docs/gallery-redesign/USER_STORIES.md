# User Stories — Refonte galerie d'images (MVP V1)

> Spécification d'origine du chantier, en 13 US (US-00 à US-12). Contexte et périmètre : [README.md](./README.md).
>
> **Ce qui fait foi** : les ADR [0005](../adr/0005-gallery-thumbnail-anatomy.md) (anatomie de la vignette) et [0006](../adr/0006-editing-a-gallery-image-adds-a-copy.md) (retoucher ajoute une copie), puis le code. Là où le construit diffère de l'US, une note **Construit** le dit et renvoie à l'ADR ou au code ; le texte d'origine qu'elle remplace est barré.
>
> Les procédures de test listent des scénarios Cypress : les specs de `cypress/` ne sont pas exécutées par la CI. La couverture automatisée de la galerie est en Jest (`tests/editor/gallery-*.test.js`, `tests/shared/gallery/`, `tests/server/image/`).

---

**US-00 — Spike Mosaico** ✅ (terminée)

- Investigation de la compatibilité Mosaico : livrable [MOSAICO_COMPAT.md](./MOSAICO_COMPAT.md)
- Identification des contraintes architecturales
- Décision : l'UI de la galerie est un plugin Vue posé à côté de Mosaico, pas une réécriture de ses templates

**US-01 — Modèle de données : extensions Image** ✅ (terminée)

- Ajout des champs `label`, `source`, `externalMetadata` (puis `uploadedAt`, et `width`/`height` pour l'infobulle de l'US-09) à chaque entrée du tableau `files` du document `Gallery` (`packages/server/image/gallery.schema.js`)
- ~~Index Mongo sur libellé, format, date~~
- Tests unitaires Jest

> **Construit** : aucun index. Les images ne sont pas des documents mais un tableau dans un document par email ou par template (MOSAICO_COMPAT §3.1), et le filtrage se fait en mémoire (note de l'US-06).

**US-02 — API backend : recherche et filtres** ✅ (terminée)

- `GET /api/images/gallery/:mongoId` accepte `search`, `format` et `sortBy` (`date_desc`, `date_asc`) ; sans eux, la réponse reste celle que Mosaico attend
- `PATCH /api/images/gallery/:mongoId/:imageName/label` renomme le libellé ; une image n'a pas d'`id`, elle est identifiée par son nom technique
- Les routes qui écrivent dans la galerie exigent la capacité `gallery.manage`
- Tests Jest, compatibilité Mosaico préservée

**US-03 — Script de migration des données** ✅ (terminée)

- Migration idempotente (relançable sans dommage), option `--dry-run`
- `packages/server/scripts/migrate-gallery-v1.js` initialise `label` (depuis le nom technique), `source`, `externalMetadata` et `uploadedAt` ; `backfill-gallery-dimensions.js` remplit `width` et `height`
- ~~Initialisation des thumbnails standardisés~~

> **Construit** : aucune vignette n'est générée. Elles sont servies à la volée par `/api/images/cover/111x111/…` (MOSAICO_COMPAT §1.4).

**US-04 — Infrastructure Vue dans l'éditeur**

Mise en place de l'infrastructure technique pour héberger un composant Vue dans le contexte éditeur, sans modifier le comportement de Mosaico.

- ~~Injection d'un `<div id="gallery-panel">` dans un template de l'éditeur (template Knockout `tmpl-badsender/toolbox.tmpl.html`), monté via le pattern plugin existant~~
- Bootstrap d'une instance Vue 2 — **Vue nu, sans Vuetify** (voir note d'architecture ci-dessous)
- Canal de communication Knockout ↔ Vue (événements custom + souscriptions aux observables)
- Coexistence Knockout + Vue validée sur les flows critiques de Mosaico

> **Construit** : `packages/editor/src/js/vue/galleryPlugin.js`, enregistré dans le tableau `extensions` de `app.js`, déclare un binding Knockout `vueGalleryPanel` ; `tmpl-badsender/toolbox.tmpl.html` le pose sur un `<div>` par galerie (email, template), et chacun monte sa propre instance Vue. Vue → Knockout passe par `galleryBridge` (`src/js/ext/badsender-gallery-bridge.js`), un `EventTarget` exposé au viewModel comme `vm.galleryBridge`.

> **Note d'architecture (décidée en US-04, juin 2026).** L'UI de la galerie est construite en **Vue nu avec templates inline**, à l'identique des plugins Vue déjà présents dans l'éditeur (`espPlugin`, `customizedBlockPlugin`, `personalizedBlocksPlugin`, `trackingParamsPlugin`), et bundlée par le build gulp/browserify existant. **Pas de Vuetify, pas de fichiers `.vue`.** Raisons : (1) l'éditeur Mosaico n'utilise pas Vuetify — seule la UI de gestion Nuxt l'utilise ; (2) le build gulp de l'éditeur ne compile pas les `.vue` (ni `vue-loader` ni `vueify`) ; (3) le CSS global de Vuetify 2 (`.v-application`, resets) entrerait en collision avec le CSS de Mosaico dans le même DOM, ce qui contredirait le mandat « ne rien casser ». La cohérence visuelle vient du mockup et de la palette (navy `#0d3b4f`, cyan `#1bb5d6`), appliquée en **CSS scopé** au panneau. La virtualisation (US-05) utilise `vue-virtual-scroller` (lib autonome, indépendante de Vuetify).

**Procédure de test pour cette US** :

- Tests unitaires Jest sur les helpers d'injection et de communication
- Tests Cypress de non-régression Mosaico :
  - Ouverture de l'éditeur
  - Création d'un nouveau bloc
  - Drag-and-drop d'un bloc
  - Modification d'un texte
  - Modification d'une image (insertion, déplacement)
  - Upload d'une image (galerie + drop direct)
  - Sauvegarde
  - Export
- Test manuel approfondi : 30 min d'utilisation libre de l'éditeur pour détecter d'éventuels comportements inattendus
- Mesure de la mémoire consommée avant/après injection Vue (Chrome DevTools)
- Mesure du temps de chargement de l'éditeur avant/après injection Vue
- Test sur navigateurs : Chrome, Firefox, Safari récents (Edge si supporté)
- Test sur 3 tailles d'écran : 13", 15", 27"
- ⚠ Aucune fonctionnalité utilisateur visible à cette étape, c'est uniquement de la plomberie technique

**US-05 — Grille refondue (sans interactions)**

Affichage de la nouvelle grille à la place de l'ancienne, sans encore brancher les interactions.

- Composant Vue `galleryPanel` (template inline, cf. note d'architecture US-04) qui affiche la grille
- Vignettes carrées avec damier sur transparence
- Libellé sous chaque vignette
- Compteur d'images
- Scroll virtualisé (lib type `vue-virtual-scroller` compatible Vue 2)
- Pas d'overlay, pas de recherche, pas de filtres dans cette US (réservés aux suivantes)

> **Construit** : la vignette est une zone image et une bande de libellé opaque sous elle ([ADR 0005](../adr/0005-gallery-thumbnail-anatomy.md)). La grille a trois colonnes de cellules de 118 px (`CELL_SIZE` dans `galleryPlugin.js`) ; l'image affichée reste la vignette `111x111` servie par le serveur.

**Procédure de test pour cette US** :

- Tests unitaires Jest sur le composant `thumb` (template inline, cf. note d'architecture US-04)
- Tests Cypress :
  - Ouverture galerie, affichage des vignettes
  - Affichage du damier sur PNG, pas sur JPG
  - Affichage du badge GIF
  - Affichage du libellé
  - Affichage du compteur
- Test avec différents volumes : 0 image, 1 image, 10 images, 100 images, 500 images
- Mesure de performance : temps d'affichage initial de la grille à chaque volume
- Vérification visuelle des thumbnails sur 5 templates clients différents
- Test de non-régression Mosaico (cf. US-04)

**US-06 — Recherche par libellé** ✅ (terminée)

> **Note d'architecture (décidée en US-06, octobre 2026).** Le filtrage se fait **côté client**, pas par appel à l'API.
>
> L'US avait été écrite avant le spike de l'US-00, donc avant de savoir que Mosaico charge la galerie **entière en une requête** et la conserve dans une observable Knockout qu'il mute lui-même à l'upload et à la suppression (`badsender-gallery.js`). Dans ce contexte, interroger le serveur :
>
> - n'apporte aucun filtrage que le client ne sache faire — le serveur n'a pas d'index et filtre ce même tableau en mémoire (mesuré sur 541 images : 16 ms de lecture Mongo, < 1 ms de filtrage) ;
> - crée une **seconde liste à réconcilier** avec celle que Mosaico possède. Un upload pendant qu'un filtre est actif est précisément l'endroit où cette réconciliation se verrait.
>
> Le prédicat est donc extrait dans `packages/shared/gallery/filter.js`, consommé par `image.service.js` **et** par le plugin éditeur — une seule définition de la sémantique, pas de dérive possible entre les deux bouts.
>
> **L'API de recherche de l'US-02 reste en place et testée.** Elle redevient le bon outil le jour où la galerie sera paginée (V2, collections).

- Barre de recherche en haut du panneau
- Filtrage instantané sur la liste déjà chargée — pas de debounce, pas d'état de chargement, pas d'erreur réseau à gérer
- `visibleImages` est une `computed` dérivée de `images` : l'observable Knockout n'est jamais réécrite
- Recherche insensible à la casse **et aux accents**, et robuste aux deux formes de normalisation Unicode (macOS écrit les noms de fichiers en NFD, le champ de saisie produit du NFC)
- État vide soigné si la recherche ne donne rien

**Procédure de test pour cette US** :

- Tests unitaires Jest sur le prédicat partagé (`tests/shared/gallery/filter.test.js`) et sur le flux de données du composant (`tests/editor/gallery-search.test.js`)
- Tests Cypress :
  - Recherche d'une image existante
  - Recherche d'une image inexistante (état vide)
  - Effacement de la recherche (retour à la galerie complète)
  - Recherche avec caractères spéciaux (accents, espaces, casse mixte)
  - **Upload pendant qu'un filtre est actif** — la nouvelle image doit rejoindre la grille si elle correspond
- Mesure de performance sur galerie de 500 images
- Vérification que la recherche ne re-render pas toutes les vignettes inutilement

**US-07 — Filtres par type et par date** ✅ (terminée)

Branchement des filtres rapides, sur le même prédicat partagé que l'US-06 (cf. note d'architecture ci-dessus) : un seul appel porte recherche, format et tri, donc aucune combinaison ne peut diverger.

- Filtres de format : Tous / JPG / PNG / GIF — la chip JPG attrape aussi les `.jpeg`
- Tri par date : `Date ↓` (du plus récent au plus ancien) / `Date ↑` (l'inverse), chacun avec son infobulle explicite
- **Pas d'état neutre sur le tri.** Sur une galerie remplie image par image — la seule façon dont une vraie galerie se remplit — l'ordre chargé par Mosaico est déjà celui du plus récent : mesuré sur la galerie du dépôt, l'ordre chargé et un tri `date_desc` s'accordent sur les 76 positions. Une chip « Par défaut » aurait donc dupliqué le premier tri sous un nom qui disait autre chose. Trier explicitement rend aussi l'ordre déterministe, au lieu de dépendre de l'ordre d'insertion en base.
- Cumul avec la recherche
- États vides distincts : une recherche sans résultat ne se lit pas comme un format dont la galerie n'a aucune image

**Procédure de test pour cette US** :

- Tests unitaires Jest sur la combinaison filtres + recherche + tri, et sur la stabilité du tri à horodatages égaux
- Tests Cypress :
  - Filtre JPG, vérification que seuls les JPG s'affichent
  - Filtre JPG avec variantes JPEG, jpg, JPEG, JpG (toutes variantes de casse)
  - Tri récent, tri ancien
  - Combinaison filtre + recherche
  - Désactivation de tous les filtres (retour à "Tous")
  - Infobulles des chips de tri
- Mesure de performance : temps d'application d'un filtre sur galerie de 500 images

**US-08 — Overlay au survol des vignettes**

Affichage des actions au survol.

- ~~Overlay foncé en bas de la vignette au survol~~
- ~~2 boutons : Éditer (icône crayon), Supprimer (icône poubelle)~~
- Animation discrète à l'apparition
- ~~Pas de comportement encore branché sur les boutons (US suivantes)~~

> **Construit autrement — [ADR 0005](../adr/0005-gallery-thumbnail-anatomy.md)** : l'overlay occupe la seule zone image, jamais la bande de libellé, et porte trois actions branchées : retoucher (US-10), renommer (US-11), supprimer. Elles n'apparaissent qu'avec la capacité `gallery.manage` ; « retoucher » est absent pour les GIF et les SVG ([ADR 0006](../adr/0006-editing-a-gallery-image-adds-a-copy.md)). La suppression demande une confirmation (`window.confirm`, décision du PO du 2026-10-11) qui nomme l'image et rappelle que les emails qui l'utilisent ne sont pas touchés.

**Procédure de test pour cette US** :

- Tests Cypress :
  - Survol d'une vignette → overlay visible
  - Sortie de la vignette → overlay disparaît
  - Survol multiple successif sur plusieurs vignettes
- Test visuel sur 3 navigateurs
- Test au clavier (focus visible attendu pour l'accessibilité de base)
- Vérification qu'aucune impact perf n'est introduit (pas de re-render à chaque hover)

**US-09 — Tooltip au survol prolongé**

Ajout du tooltip avec métadonnées.

- Tooltip composant custom (pas de Vuetify, cf. note d'architecture US-04)
- Affiche : libellé complet, dimensions, format, date d'upload
- Apparition après 500ms de survol pour éviter le bruit visuel
- Disparition immédiate à la sortie

> **Construit** : l'infobulle s'ouvre hors de la vignette, dont l'overlay occupe déjà l'intérieur ([ADR 0005](../adr/0005-gallery-thumbnail-anatomy.md)).

**Procédure de test pour cette US** :

- Tests Cypress :
  - Survol prolongé → tooltip apparaît avec les bonnes infos
  - Vérification du contenu : libellé, dimensions, format, date
  - Tooltip se ferme à la sortie de la vignette
- Vérification visuelle sur 5 images avec libellés courts/longs
- Test de non-superposition avec l'overlay d'actions

**US-10 — Action Éditer (relance Konva)**

Branchement du bouton Éditer pour relancer Konva sur une image existante.

- Au clic sur le bouton Éditer de l'overlay → ouverture de l'éditeur Konva avec l'image source chargée
- ~~À la sauvegarde dans Konva → remplacement de l'image originale (pas de nouvelle version)~~
- ~~Régénération automatique du thumbnail via Sharp~~
- ~~Mise à jour de la vignette dans la galerie~~

> **Construit autrement — [ADR 0006](../adr/0006-editing-a-gallery-image-adds-a-copy.md)** : l'enregistrement ajoute une copie numérotée (`photo.png` → `photo (2).png`) et ne remplace jamais l'originale, que les emails déjà construits utilisent par son URL. Le bouton d'enregistrement de l'éditeur lit « Enregistrer comme nouveau fichier ». Les GIF et les SVG ne sont pas retouchables. La copie a sa propre vignette, servie à la volée comme les autres. Code : `packages/editor/src/js/ext/badsender-edit-image.js`, `nextCopyLabel` dans `packages/shared/gallery/label.js`.

**Procédure de test pour cette US** :

- Tests Cypress :
  - Clic sur Éditer → Konva s'ouvre avec la bonne image
  - Modification dans Konva → sauvegarde
  - Retour à la galerie → la copie numérotée apparaît, l'originale est inchangée
  - Annulation dans Konva → galerie inchangée
- Test sur différents formats (JPG, PNG) ; pas de bouton de retouche sur un GIF ni un SVG
- Test sur différentes dimensions (petites images, grandes images)
- Vérification que l'image dans les emails utilisant cette image n'est pas affectée (ISO comportement)

**US-11 — Action Renommer (édition inline)**

Édition inline du libellé par double-clic.

- Double-clic sur le libellé d'une vignette → champ input apparaît
- Sélection automatique du texte à l'entrée en édition
- Validation par Entrée ou par perte de focus
- Annulation par Échap
- Appel à `PATCH /api/images/gallery/:mongoId/:imageName/label`
- Mise à jour optimiste dans l'UI
- Gestion d'erreur (libellé vide, trop long, erreur réseau)

> **Construit** : le renommage s'ouvre aussi par le bouton « renommer » de l'overlay, le seul chemin au clavier ([ADR 0005](../adr/0005-gallery-thumbnail-anatomy.md)). Un libellé fait au plus 255 caractères (`MAX_LABEL_LENGTH`, `packages/shared/gallery/label.js`).

**Procédure de test pour cette US** :

- Tests unitaires Jest sur la logique d'édition inline
- Tests Cypress :
  - Double-clic → input apparaît avec le texte sélectionné
  - Modification + Entrée → libellé mis à jour
  - Modification + perte de focus → libellé mis à jour
  - Modification + Échap → libellé non modifié
  - Libellé vide → message d'erreur ou refus
  - Persistence après refresh
- Test que le nom de fichier technique reste inchangé
- Test que la recherche fonctionne avec le nouveau libellé immédiatement
- Test sur libellés avec caractères spéciaux, accents, émojis

**US-12 — Polissage et finitions**

Améliorations transversales et finalisation.

- Animations légères (apparition overlay, transitions filtres)
- États vides soignés (galerie vide, recherche sans résultat, filtre sans résultat)
- Loading states (squelettes pendant le chargement)
- Gestion des erreurs réseau (timeout, 5xx, etc.)
- Accessibilité de base (rôles ARIA, focus visible, navigation clavier)
- Audit final de cohérence visuelle avec l'équipe qui refond les panneaux de l'éditeur

**Procédure de test pour cette US** :

- Tests Cypress sur tous les états vides
- Tests Cypress sur les erreurs réseau (avec interception)
- Test au clavier complet (Tab, Entrée, Échap, flèches)
- Audit Lighthouse sur la page de l'éditeur
- Test sur navigateurs : Chrome, Firefox, Safari récents
- Test sur 3 tailles d'écran
- Vérification finale du respect des métriques de performance définies
- Recette par le PO sur 3 cas d'usage réels

### Risques techniques identifiés

- **Coexistence Knockout + Vue** : conflits possibles sur le DOM, les événements clavier, le CSS. À adresser dans l'US-04 et tester systématiquement par la suite.
- **Performance en production** : contexte de dégradation observée, vigilance accrue à chaque PR.
- **Mosaico** : compatibilité de l'API images existante à préserver absolument (validée lors de l'US-00).
- **Vue 2 / Vuetify 2** : versions anciennes, pas de migration dans ce projet, on reste cohérent avec l'existant.
- **Migration des données** : scripts de l'US-03 (terminée).
- **Préservation du comportement asymétrique existant** : upload dans la galerie déclenche l'éditeur Konva, upload direct dans l'email déclenche le resize auto. Ce comportement reste inchangé.
