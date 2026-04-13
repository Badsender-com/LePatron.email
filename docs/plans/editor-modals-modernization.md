# Plan de modernisation des modales de l'éditeur

## Objectif

Uniformiser toutes les modales de l'éditeur vers le design system Vuetify utilisé dans l'admin, en suivant les guidelines UX de LePatron.email.

---

## Inventaire des modales

### 1. Modales Vue.js / Materialize CSS

| #   | Modale          | Fichier                                                    | Priorité | Statut       |
| --- | --------------- | ---------------------------------------------------------- | -------- | ------------ |
| 1.1 | Delete Block    | `src/js/vue/components/delete-block-modal/delete.modal.js` | Haute    | [x] **Fait** |
| 1.2 | Save Block      | `src/js/vue/components/save-block-modal/save-modal.js`     | Haute    | [x] **Fait** |
| 1.3 | Send Test Email | `src/js/vue/components/send-test/test-modal.js`            | Haute    | [x] **Fait** |
| 1.4 | Base Modal      | `src/js/vue/components/modal/modalComponent.js`            | Critique | [x] **Fait** |

### 2. Modales ESP (Email Service Provider)

| #   | Modale         | Fichier                                                      | Priorité | Statut       |
| --- | -------------- | ------------------------------------------------------------ | -------- | ------------ |
| 2.1 | ESP Container  | `src/js/vue/components/esp/esp-send-mail.js`                 | Haute    | [x] **Fait** |
| 2.2 | Actito         | `src/js/vue/components/esp/providers/ActitoComponent.js`     | Moyenne  | [x] **Fait** |
| 2.3 | SendinBlue     | `src/js/vue/components/esp/providers/SendinBlueComponent.js` | Moyenne  | [x] **Fait** |
| 2.4 | DSC            | `src/js/vue/components/esp/providers/DscComponent.js`        | Moyenne  | [x] **Fait** |
| 2.5 | Adobe Campaign | `src/js/vue/components/esp/providers/AdobeComponent.js`      | Moyenne  | [x] **Fait** |

### 3. Modales jQuery UI (Legacy)

| #   | Modale                | Fichier                         | Priorité | Statut      |
| --- | --------------------- | ------------------------------- | -------- | ----------- |
| 3.1 | Incompatible Template | `src/js/template-loader.js:594` | Basse    | [ ] À faire |

### 4. Dialogues Knockout.js (Custom)

| #   | Modale           | Fichier                                            | Priorité | Statut       |
| --- | ---------------- | -------------------------------------------------- | -------- | ------------ |
| 4.1 | Image Gallery    | `src/tmpl-badsender/dialog-select-image.tmpl.html` | Haute    | [x] **Fait** |
| 4.2 | Background Image | `src/js/ext/badsender-widget-bgimage.js`           | Moyenne  | [x] **Fait** |

### 5. Éditeur d'images (Konva.js)

| #   | Modale              | Fichier                                | Priorité | Statut       |
| --- | ------------------- | -------------------------------------- | -------- | ------------ |
| 5.1 | Image Editor        | `src/js/bindings/image-editor.js`      | Haute    | [x] **Fait** |
| 5.2 | Styles Image Editor | `src/css/badsender-image-cropper.less` | Haute    | [x] **Fait** |

### 6. Dialogues TinyMCE

| #   | Modale      | Fichier                                              | Priorité | Statut      |
| --- | ----------- | ---------------------------------------------------- | -------- | ----------- |
| 6.1 | Link Editor | `src/js/ext/link-with-color.js:505`                  | Moyenne  | [ ] À faire |
| 6.2 | Font Size   | `src/js/ext/tinymce/tinymce-extend-functions.js:101` | Basse    | [ ] À faire |
| 6.3 | Source Code | Plugin TinyMCE `code` (intégré)                      | Basse    | [ ] À faire |

---

## Analyse technique par technologie

### Vue.js + Materialize CSS (8 modales)

**État actuel :**

- Utilise les classes Materialize CSS (`modal-content`, `modal-footer`, `btn`, `input-field`)
- Initialisation via `M.Modal.init()` et `M.updateTextFields()`
- Validation avec Vuelidate
- Grid système Materialize (`row`, `col s12`)

**Transformation requise :**

- Remplacer les classes Materialize par Vuetify (`v-dialog`, `v-card`, `v-btn`, `v-text-field`)
- Migrer la validation vers les règles Vuetify natives
- Adapter le système de grid vers Vuetify (`v-row`, `v-col`)
- Supprimer les appels `M.updateTextFields()`

**Complexité :** Moyenne - Structure similaire, principalement du remplacement de classes

### Knockout.js + Custom (2 modales)

**État actuel :**

- Templates HTML avec bindings Knockout (`data-bind`)
- Contrôle via observables (`showDialogGallery`)
- CSS personnalisé dans plusieurs fichiers LESS

**Transformation requise :**

- Choix architectural : migrer vers Vue.js ou moderniser le CSS uniquement
- Option A : Réécriture complète en Vue.js (effort important)
- Option B : Modernisation CSS uniquement (effort moindre, dette technique maintenue)

**Complexité :** Haute - Nécessite décision architecturale

### jQuery UI Dialog (1 modale)

**État actuel :**

- `$('#incompatible-template').dialog({ modal: true, ... })`
- Styles dans `style_elements_jquery.less`

**Transformation requise :**

- Remplacer par un composant Vue.js simple
- Supprimer la dépendance jQuery UI pour les dialogues

**Complexité :** Faible - Modale simple avec un seul bouton OK

### Konva.js Image Editor (1 modale)

**État actuel :**

- Overlay plein écran avec `.editor-frame`
- Header avec fond `--v-primary-base` (déjà aligné partiellement)
- Canvas Konva pour l'édition
- Barre d'outils personnalisée

**Transformation requise :**

- Moderniser le header/footer pour correspondre au design Vuetify
- Uniformiser les boutons et contrôles
- Conserver Konva.js pour le canvas (pas de migration nécessaire)

**Complexité :** Moyenne - Principalement CSS, logique métier intacte

### TinyMCE Dialogs (3 modales)

**État actuel :**

- Utilise `editor.windowManager.open()` (API TinyMCE native)
- Styles contrôlés par le skin TinyMCE
- Personnalisation limitée

**Transformation requise :**

- Option A : Créer un skin TinyMCE personnalisé (effort important)
- Option B : Remplacer par des modales Vue.js externes (complexe, perte d'intégration)
- Option C : Ajuster le CSS du skin existant (compromis)

**Complexité :** Haute - API TinyMCE contraignante

---

## Stratégie de migration recommandée

### Phase 1 : Fondations (Priorité Critique)

1. **Créer un composant modal Vuetify de base** pour l'éditeur

   - Similaire à celui de l'admin mais adapté au contexte éditeur
   - Gestion du z-index compatible avec l'éditeur (z-index élevés existants)

2. **Moderniser `modalComponent.js`** (1.4)
   - Point d'entrée pour toutes les autres modales Vue.js

### Phase 2 : Modales Vue.js principales (Priorité Haute)

3. **Delete Block** (1.1)
4. **Save Block** (1.2)
5. **Send Test Email** (1.3)
6. **ESP Container** (2.1)

### Phase 3 : Modales ESP spécifiques (Priorité Moyenne)

7. **Actito** (2.2)
8. **SendinBlue** (2.3)
9. **DSC** (2.4)
10. **Adobe Campaign** (2.5)

### Phase 4 : Galerie d'images (Priorité Haute)

11. **Image Gallery** (4.1) - Décision : Vue.js ou CSS only
12. **Background Image** (4.2)

### Phase 5 : Éditeur d'images (Priorité Haute)

13. **Image Editor** (5.1, 5.2)

### Phase 6 : TinyMCE (Priorité Moyenne/Basse)

14. **Link Editor** (6.1)
15. **Font Size** (6.2)
16. **Source Code** (6.3)

### Phase 7 : Legacy (Priorité Basse)

17. **Incompatible Template** (3.1)

---

## Spécifications de design

### Structure modale standard

```html
<v-dialog v-model="dialog" max-width="500px">
  <v-card>
    <v-card-title class="text-h5"> Titre de la modale </v-card-title>

    <v-card-text>
      <!-- Contenu -->
    </v-card-text>

    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn text @click="close">Annuler</v-btn>
      <v-btn color="primary" @click="submit">Confirmer</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

### Tokens de design

| Token                | Valeur      | Usage                     |
| -------------------- | ----------- | ------------------------- |
| `--v-primary-base`   | Variable    | Header, boutons primaires |
| `--v-accent-base`    | Variable    | Éléments d'accentuation   |
| Border radius        | 4px         | Cards, boutons            |
| Spacing              | 16px / 24px | Padding interne           |
| Max-width par défaut | 500px       | Modales standard          |
| Max-width large      | 800px       | Galerie, éditeur ESP      |
| z-index              | 200+        | Au-dessus de l'éditeur    |

### États des boutons

- **Primaire** : `v-btn color="primary"` - Action principale
- **Secondaire** : `v-btn text` - Annulation, actions secondaires
- **Danger** : `v-btn color="error"` - Suppression
- **Disabled** : `:disabled="isLoading"` - Pendant le traitement

---

## Dépendances et prérequis

### Fichiers CSS à modifier

- `src/css/badsender-editor.less` - Styles généraux éditeur
- `src/css/badsender-main-toolbox.less` - Toolbox latérale
- `src/css/style_elements_jquery.less` - Styles jQuery UI (à supprimer progressivement)
- `src/css/badsender-image-cropper.less` - Éditeur d'images

### Fichiers JS principaux

- `src/js/vue/components/modal/modalComponent.js` - Base modal
- `src/js/vue/espPlugin.js` - Point d'entrée ESP
- `src/js/bindings/image-editor.js` - Éditeur d'images
- `src/js/ext/link-with-color.js` - Plugin TinyMCE lien

### Variables CSS requises

```less
// Déjà définies dans le thème
--v-primary-base
--v-accent-base
--gray-400
--gray-600
```

---

## Critères de validation

### Pour chaque modale

- [ ] Structure HTML conforme au template standard
- [ ] Classes Vuetify utilisées (pas de Materialize)
- [ ] Boutons avec les bons états (loading, disabled)
- [ ] Responsive sur tablette (min 768px)
- [ ] Z-index correct (visible au-dessus de l'éditeur)
- [ ] Transitions fluides (ouverture/fermeture)
- [ ] Accessibilité : focus trap, escape pour fermer
- [ ] Tests manuels : création, édition, annulation

---

## Estimation effort

| Phase   | Effort estimé | Dépendances                    |
| ------- | ------------- | ------------------------------ |
| Phase 1 | 1-2 jours     | Aucune                         |
| Phase 2 | 2-3 jours     | Phase 1                        |
| Phase 3 | 2-3 jours     | Phase 2                        |
| Phase 4 | 3-5 jours     | Phase 1, décision architecture |
| Phase 5 | 2-3 jours     | Phase 1                        |
| Phase 6 | 3-5 jours     | Recherche skin TinyMCE         |
| Phase 7 | 0.5 jour      | Phase 1                        |

**Total estimé : 14-22 jours**

---

## Notes et décisions à prendre

### Décision 1 : Migration Knockout.js

**Question :** Faut-il migrer les modales Knockout.js (galerie d'images) vers Vue.js ?

**Options :**

- A) Migration complète vers Vue.js (effort ~5 jours, dette technique éliminée)
- B) Modernisation CSS uniquement (effort ~1 jour, dette technique maintenue)

**Recommandation :** Option A si refonte majeure prévue, Option B sinon

### Décision 2 : TinyMCE Dialogs

**Question :** Comment moderniser les dialogues TinyMCE ?

**Options :**

- A) Créer un skin TinyMCE personnalisé
- B) Surcharger les styles CSS existants
- C) Remplacer par des modales Vue.js externes

**Recommandation :** Option B pour le court terme, Option A si investissement long terme

---

## Changelog

| Date       | Modification                                                          |
| ---------- | --------------------------------------------------------------------- |
| 2025-04-13 | Création du plan initial                                              |
| 2025-04-13 | **Phase 1 complétée** : Base Modal (1.4) modernisé vers Vuetify-style |
| 2025-04-13 | **Phase 2 & 3 complétées** : Toutes les modales Vue.js modernisées    |
| 2025-04-13 | **Phase 4 complétée** : Galerie d'images Knockout.js modernisée       |
| 2025-04-13 | **Phase 5 complétée** : Éditeur d'images Konva.js modernisé           |

### Détails Phase 5

**Changements CSS (`badsender-image-cropper.less`) :**

- Backdrop sombre conservé (rgba(0,0,0,0.85)) pour séparation visuelle avec la topbar
- Z-index élevé (10001) pour passer au-dessus de tous les éléments
- Conteneur avec border-radius 8px uniforme et box-shadow Vuetify (elevation-24)
- Header avec couleur plus foncée (#00626e) pour différencier de la topbar principale
- Header avec min-height 48px (cohérent avec Vuetify toolbar)

**Changements JS (`image-editor.js`) :**

- Injection de la modale dans le `body` au lieu d'après la dropzone (évite les problèmes de stacking context)
- Ajout de la classe `mo` pour hériter des styles Mosaico globaux

### Détails Phase 4

**Changements (CSS only - pas de migration vers Vue.js) :**

- Modernisation de `badesender-image-gallery.less`
- Backdrop aligné avec les modales (rgba(0,0,0,0.5), z-index: 1000)
- Conteneur avec border-radius 8px et box-shadow Vuetify
- Onglets avec style Vuetify (uppercase, letter-spacing, hover states)
- Bouton de fermeture avec hover state circulaire
- Zone de drop modernisée (dashed border, hover accent)
- Grille d'images avec gap, border-radius, transitions

**Décision architecturale :** Option B retenue (CSS only) - la logique Knockout.js reste intacte, seuls les styles sont modernisés.

### Détails Phase 2 & 3

**Changements :**

- Suppression de tous les appels `M.updateTextFields()` (Materialize)
- Les modales utilisent déjà le `ModalComponent` modernisé
- Les styles sont appliqués via `badsender-modal.less` (classes legacy supportées)
- Création de `SimpleSelect` pour remplacer `vue-select` dans test-modal.js

**Fichiers modifiés :**

- `esp-send-mail.js` - Suppression M.updateTextFields()
- `test-modal.js` - Suppression M.updateTextFields(), utilisation SimpleSelect
- `SendinBlueComponent.js` - Suppression M.updateTextFields()
- `ActitoComponent.js` - Suppression M.updateTextFields()
- `DscComponent.js` - Suppression M.updateTextFields()
- `AdobeComponent.js` - Suppression M.updateTextFields()

### Détails Phase 1

**Fichiers modifiés :**

- `src/js/vue/components/modal/modalComponent.js` - Refonte complète du composant
- `src/css/badsender-modal.less` - Nouveau fichier CSS (créé)
- `src/css/badsender-editor.less` - Import du nouveau fichier CSS

**Changements techniques :**

- Remplacement de `M.Modal.init()` (Materialize) par gestion Vue.js native (`v-if` + `isOpen`)
- Ajout de la transition `bs-modal-fade` pour l'animation d'ouverture/fermeture
- Support du backdrop click et touche Escape pour fermer
- Spinner SVG animé remplaçant le preloader Materialize
- Styles CSS modernisés compatibles avec les classes legacy (`modal-content`, `modal-footer`, `btn`, `btn-flat`)
- Z-index élevé (1000) pour rester au-dessus de l'éditeur
