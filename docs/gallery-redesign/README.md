# Refonte de la galerie d'images (V1)

Contexte produit et périmètre de la refonte de la galerie d'images de l'éditeur (épic #843). Ce qui fait foi, dans l'ordre : les ADR [0005](../adr/0005-gallery-thumbnail-anatomy.md) (anatomie de la vignette) et [0006](../adr/0006-editing-a-gallery-image-adds-a-copy.md) (retoucher ajoute une copie), puis le code. Les documents de ce dossier sont le cadrage : quand ils divergent du code, c'est le code qui a raison.

## Pourquoi

Trois irritants : des vignettes trop grosses aux libellés invisibles, aucune recherche, et aucun moyen de rouvrir l'éditeur d'image sur une image déjà dans la galerie. La V1 les traite sans introduire de nouveau concept produit. Elle vise d'abord la marketeuse sous deadline qui veut retrouver vite la bonne image, ensuite l'agence ou le freelance qui pousse l'outil plus loin.

## Ce qui ne change pas

La V1 ajoute la recherche, les filtres, le renommage et la retouche ; le reste du comportement reste celui d'avant :

- Un fichier déposé dans la galerie passe par l'éditeur d'image (Konva) avant l'envoi ; une image déposée directement dans un bloc est redimensionnée sans lui ([MOSAICO_COMPAT.md](./MOSAICO_COMPAT.md) §1.2).
- Une image est adressée par son URL, et les emails qui l'utilisent pointent vers cette URL. Supprimer une image de la galerie retire l'entrée, pas le fichier stocké : les emails ne sont pas touchés. Pas de corbeille.
- Les routes que Mosaico consomme gardent leur réponse ([MOSAICO_COMPAT.md](./MOSAICO_COMPAT.md) §1).

Deux écarts décidés en cours de chantier : la suppression demande une confirmation (la corbeille est désormais un bouton parmi trois, plus facile à toucher par erreur), et retoucher une image ajoute une copie numérotée au lieu de remplacer l'originale ([ADR 0006](../adr/0006-editing-a-gallery-image-adds-a-copy.md)).

## Périmètre

**Dans la V1**

- Grille virtualisée de vignettes : une zone image et une bande de libellé ([ADR 0005](../adr/0005-gallery-thumbnail-anatomy.md)), damier sous les images transparentes, badge GIF, compteur.
- Recherche sur le libellé, filtres par format (JPG, PNG, GIF), tri par date.
- Infobulle : libellé complet, dimensions d'origine, format, date d'ajout.
- Actions au survol : retoucher, renommer, supprimer, réservées à la capacité `gallery.manage` ([ADR 0004](../adr/0004-reviewer-writer-tech-admin-roles.md)).
- Champs `label`, `source`, `externalMetadata`, `uploadedAt`, `width`, `height` sur chaque image, et les scripts qui les remplissent pour les images existantes.

**Reporté en V2 et au-delà** : panneau de droite et disposition en trois colonnes, collections, sélection multiple et actions groupées, corbeille et restauration, panneau de détails, indicateur d'usage (« utilisée dans N emails »), étiquetage automatique, intégration de DAM, vues prédéfinies, transfert d'images entre galeries, historique des versions.

## Décisions produit reportées

À ne pas rouvrir dans la V1, même partiellement :

- **Lien image ↔ email.** Aucune cascade : modifier ou supprimer une image de la galerie ne change aucun email. Un lien plus fort (« changer le logo partout en une fois ») demande une discussion produit dédiée ; l'ADR 0006 note ce qu'il faudrait pour remplacer une image en avertissant des emails touchés.
- **Collections plutôt que dossiers ou tags.** Le modèle retenu pour la V2 : des regroupements non exclusifs, créés par les utilisateurs et partagés par tous les utilisateurs du template.
- **Workspaces.** Aucun lien avec la galerie, qui reste rattachée au template (« Commun au template ») ou à l'email (« Spécifique à l'email »).

## Où vit le code

Les fichiers ci-dessous arrivent avec les PR #1293 à #1296.

| Couche  | Fichiers                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serveur | `packages/server/image/` (`image.routes.js`, `gallery.schema.js`, `image.service.js`), `packages/server/common/upload-identity.service.js`                                                                                   |
| Partagé | `packages/shared/gallery/filter.js` (recherche, format, tri, formats non retouchables), `packages/shared/gallery/label.js` (nettoyage du libellé, numéro de copie)                                                           |
| Éditeur | `packages/editor/src/js/vue/galleryPlugin.js`, `vue/components/gallery/`, `ext/badsender-gallery-bridge.js`, `ext/badsender-edit-image.js`, `ext/badsender-rename-gallery-image.js`, `ext/badsender-remove-gallery-image.js` |
| Scripts | `packages/server/scripts/migrate-gallery-v1.js`, `packages/server/scripts/backfill-gallery-dimensions.js`                                                                                                                    |
| Tests   | `tests/editor/gallery-*.test.js`, `tests/shared/gallery/`, `tests/server/image/`                                                                                                                                             |

L'interface de la galerie est un plugin Vue de l'éditeur, en Vue nu avec des templates inline, sans Vuetify : la note d'architecture de l'US-04 dans [USER_STORIES.md](./USER_STORIES.md) explique pourquoi.

## Les documents de ce dossier

- [USER_STORIES.md](./USER_STORIES.md) : la spécification d'origine, US-00 à US-12, annotée là où le construit diffère.
- [MOSAICO_COMPAT.md](./MOSAICO_COMPAT.md) : ce que Mosaico consomme (routes, champs, nom technique d'une image). À relire avant de toucher au modèle ou aux routes.
- [lepatron-gallery-mockup-final.html](./lepatron-gallery-mockup-final.html) : maquette statique, à ouvrir dans un navigateur. Elle a été dessinée pour la V2 : ignorer les collections, la sélection multiple et le panneau de détails. Son overlay recouvre le libellé, ce que l'ADR 0005 corrige.

## Points de vigilance

- **Volume.** Chez les plus gros clients, une galerie de template partagée par plusieurs centaines d'utilisateurs compte plusieurs centaines d'images. La grille est virtualisée ; le filtrage se fait dans le navigateur, sur la liste que Mosaico a déjà chargée (note de l'US-06).
- **Tests.** Les scénarios Cypress des US ne sont pas exécutés par la CI ([AGENTS.md](../../AGENTS.md), « Testing ») : la couverture automatisée de la galerie est en Jest.
