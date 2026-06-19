# User Stories — Refonte galerie d'images (MVP V1)

> Découpage opérationnel pour Claude Code et l'équipe.
> Chaque US = une PR à part (option B validée).
> Estimations en jours-développeur ; à ajuster selon ressources.
>
> **Périmètre V1 resserré** : améliorer l'existant sans introduire de nouveaux concepts produit.
> Les fonctionnalités plus ambitieuses (collections, panneau droit, bulk, soft delete) sont
> reportées en V2+ — voir `CLAUDE.md` section 4.

---

## Légende

- 🔴 **Critique** : bloquant pour la suite
- 🟡 **Majeur** : fonctionnalité MVP
- 🟢 **Polissage** : amélioration

- ⏱ Estimation
- ⚠ Risques / points de vigilance
- 🧪 Stratégie de test

---

**US-00 — Spike Mosaico** ✅ (terminée)

- Investigation de la compatibilité Mosaico
- Identification des contraintes architecturales
- Décision : approche Option 3 (Vue à côté de Mosaico)

**US-01 — Modèle de données : extensions Image** ✅ (terminée)

- Ajout des champs `label`, `source`, `externalMetadata`
- Index Mongo sur libellé, format, date
- Tests unitaires Jest

**US-02 — API backend : recherche et filtres** ✅ (terminée)

- Endpoint `GET /api/templates/:templateId/images` enrichi
- Endpoint `PATCH /api/images/:id/label`
- Tests Jest, compatibilité Mosaico préservée

**US-03 — Script de migration des données** ✅ (terminée)

- Migration idempotente, resumable, dry-run
- Initialisation des libellés et thumbnails standardisés

**US-04 — Infrastructure Vue dans l'éditeur**

Mise en place de l'infrastructure technique pour héberger un composant Vue dans le contexte éditeur, sans toucher à Mosaico.

- Injection d'un `<div id="gallery-panel">` dans un template de l'éditeur (template Knockout `tmpl-badsender/toolbox.tmpl.html`), monté via le pattern plugin existant
- Bootstrap d'une instance Vue 2 sur ce div — **Vue nu, sans Vuetify** (voir note d'architecture ci-dessous)
- Canal de communication Knockout ↔ Vue (événements custom + souscriptions aux observables)
- Coexistence Knockout + Vue validée sur les flows critiques de Mosaico

> **Note d'architecture (décidée en US-04, juin 2026).** L'UI de la galerie est construite en **Vue nu avec templates inline**, à l'identique des 4 plugins Vue déjà présents dans l'éditeur (`espPlugin`, `customizedBlockPlugin`, `personalizedBlocksPlugin`, `trackingParamsPlugin`), et bundlée par le build gulp/browserify existant. **Pas de Vuetify, pas de fichiers `.vue`.** Raisons : (1) l'éditeur Mosaico n'utilise pas Vuetify — seule la UI de gestion Nuxt l'utilise ; (2) le build gulp de l'éditeur ne compile pas les `.vue` (ni `vue-loader` ni `vueify`) ; (3) le CSS global de Vuetify 1.12 (`.v-application`, resets) entrerait en collision avec le CSS de Mosaico dans le même DOM, ce qui contredirait le mandat « ne rien casser ». La cohérence visuelle vient du mockup et de la palette (navy `#0d3b4f`, cyan `#1bb5d6`), appliquée en **CSS scopé** au panneau. La virtualisation (US-05) utilise `vue-virtual-scroller` (lib autonome, indépendante de Vuetify).

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
- Vérification visuelle des thumbnails sur 5 templates clients différents (Clarins, Editis...)
- Test de non-régression Mosaico (cf. US-04)

**US-06 — Recherche par libellé**

Branchement de la barre de recherche sur l'API.

- Barre de recherche en haut du panneau
- Debounce de 300ms pour éviter de saturer l'API
- Requête vers `GET /api/templates/:templateId/images?search=`
- Affichage du résultat dans la grille
- État vide soigné si recherche sans résultat

**Procédure de test pour cette US** :

- Tests unitaires Jest sur la logique de debounce et d'appel API
- Tests Cypress :
  - Recherche d'une image existante
  - Recherche d'une image inexistante (état vide)
  - Effacement de la recherche (retour à la galerie complète)
  - Recherche avec caractères spéciaux (accents, espaces, casse mixte)
- Mesure de performance : temps de réponse de la recherche sur galerie de 500 images (cible : <300ms)
- Vérification que la recherche ne re-render pas toutes les vignettes inutilement

**US-07 — Filtres par type et par date**

Branchement des filtres rapides.

- Filtres : Tous / JPG / PNG / GIF
- Filtres : Récent / Ancien (tri)
- Requêtes vers l'API avec `?format=` et `?sortBy=`
- Cumul avec la recherche (recherche + filtre)

**Procédure de test pour cette US** :

- Tests unitaires Jest sur la logique de combinaison filtres + recherche
- Tests Cypress :
  - Filtre JPG, vérification que seuls les JPG s'affichent
  - Filtre JPG avec variantes JPEG, jpg, JPEG, JpG (toutes variantes de casse)
  - Tri récent, tri ancien
  - Combinaison filtre + recherche
  - Désactivation de tous les filtres (retour à "Tous")
- Mesure de performance : temps d'application d'un filtre sur galerie de 500 images
- Test que les requêtes ne sont pas dupliquées (vérifier le réseau dans DevTools)

**US-08 — Overlay au survol des vignettes**

Affichage des actions au survol.

- Overlay foncé en bas de la vignette au survol
- 2 boutons : Éditer (icône crayon), Supprimer (icône poubelle)
- Animation discrète à l'apparition
- Pas de comportement encore branché sur les boutons (US suivantes)

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
- À la sauvegarde dans Konva → remplacement de l'image originale (pas de nouvelle version)
- Régénération automatique du thumbnail via Sharp
- Mise à jour de la vignette dans la galerie

**Procédure de test pour cette US** :

- Tests Cypress :
  - Clic sur Éditer → Konva s'ouvre avec la bonne image
  - Modification dans Konva → sauvegarde
  - Retour à la galerie → thumbnail mis à jour
  - Annulation dans Konva → galerie inchangée
- Test sur différents formats (JPG, PNG, GIF)
- Test sur différentes dimensions (petites images, grandes images)
- Vérification que l'image dans les emails utilisant cette image n'est pas affectée (ISO comportement)
- Test que le thumbnail est bien régénéré (pas de cache stale)

**US-11 — Action Renommer (édition inline)**

Édition inline du libellé par double-clic.

- Double-clic sur le libellé d'une vignette → champ input apparaît
- Sélection automatique du texte à l'entrée en édition
- Validation par Entrée ou par perte de focus
- Annulation par Échap
- Appel à `PATCH /api/images/:id/label`
- Mise à jour optimiste dans l'UI
- Gestion d'erreur (libellé vide, trop long, erreur réseau)

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
- Audit final de cohérence visuelle avec Jonathan/Olivier

**Procédure de test pour cette US** :

- Tests Cypress sur tous les états vides
- Tests Cypress sur les erreurs réseau (avec interception)
- Test au clavier complet (Tab, Entrée, Échap, flèches)
- Audit Lighthouse sur la page de l'éditeur
- Test sur navigateurs : Chrome, Firefox, Safari récents
- Test sur 3 tailles d'écran
- Vérification finale du respect des métriques de performance définies
- Recette par toi (PO) sur 3 cas d'usage réels

### Estimation V1 actualisée

Avec l'approche Option 3 (sortir de Mosaico) et le découpage en petites PRs :

| Lot                  | US                         | Estimation                  |
| -------------------- | -------------------------- | --------------------------- |
| Backend (terminé)    | US-00 à US-03              | ✅                          |
| Infrastructure       | US-04                      | 2-3 jours                   |
| UI - Affichage       | US-05, US-08, US-09        | 3-4 jours                   |
| UI - Interactions    | US-06, US-07, US-10, US-11 | 4-5 jours                   |
| Finition             | US-12                      | 1-2 jours                   |
| **TOTAL V1 restant** |                            | **10-14 jours-développeur** |

Calendrier réaliste : **3 à 4 semaines** en intégrant le temps de review par le prestataire externe et les éventuels allers-retours.

### Risques techniques identifiés

- **Coexistence Knockout + Vue** : conflits possibles sur le DOM, les événements clavier, le CSS. À adresser dans l'US-04 et tester systématiquement par la suite.
- **Performance en production** : contexte de dégradation observée, vigilance accrue à chaque PR.
- **Mosaico** : compatibilité de l'API images existante à préserver absolument (validée lors de l'US-00).
- **Vue 2 / Vuetify 1.12** : versions anciennes, pas de migration dans ce projet, on reste cohérent avec l'existant.
- **Migration des données** : script de migration géré dans l'US-03 (terminée).
- **Préservation du comportement asymétrique existant** : upload dans la galerie déclenche l'éditeur Konva, upload direct dans l'email déclenche le resize auto. Ce comportement reste inchangé.

### Méthode de travail (post-discussion équipe)

- **Petites PRs** : chaque US = sa propre PR (validé après discussion avec le prestataire de review)
- **Tests systématiques** : chaque PR inclut une procédure de test documentée (cf. US ci-dessus)
- **Non-régression Mosaico** : test systématique à chaque PR qui touche l'infrastructure ou le DOM partagé
- **Performance** : mesure avant/après pour les PRs touchant l'affichage ou les requêtes
- **Recette PO** : validation par toi avant merge final
- **Déploiement en test** : chaque PR mergée est déployée en environnement de test pour validation manuelle
