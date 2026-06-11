# Mosaico pour les agents — golden patterns de l'éditeur

> Capitalisation de l'exploration Phase 0 du POC textgen (2026-06). L'éditeur
> (`packages/editor/`) est un **fork de Mosaico** : Knockout.js pour le modèle,
> TinyMCE 4.5.8 inline pour le texte riche, une couche **Vue 2** pour les
> modales récentes, le tout buildé par **gulp + browserify** (pas par Nuxt).
> Ce doc liste les patterns sûrs et les pièges connus pour intervenir dedans.

## 1. L'éditeur de texte riche est TinyMCE (pas FCKeditor)

- Binding KO ↔ TinyMCE : `packages/editor/src/js/bindings/wysiwygs.js`
  (init `tinymce.init` ~l.606, mode `inline: true`).
- Sync bidirectionnelle : événements `change redo undo` → `value(editor.getContent())` ;
  `ko.computed` → `setContent()` quand l'observable change ailleurs.
- Conséquence : **écrire dans l'observable suffit** — TinyMCE, la preview et
  l'export HTML suivent. Ne jamais piloter TinyMCE directement pour injecter.

## 2. Accéder au viewmodel et aux blocs

- Structure : `viewModel.content().mainBlocks().blocks()` (observableArray de blocs).
- Bloc sélectionné : `viewModel.selectedBlock()` (`viewmodel.js:47`).
- **Toutes les propriétés scalaires des blocs sont des `ko.observable`, y
  compris `type`** (wrapper générique `converter/wrapper.js`). Dans un binding :
  `ko.utils.unwrapObservable($data.type)` — jamais `$data.type == 'x'`.
- Depuis un bouton de bloc, le contexte KO fournit `$rawData` (le bloc
  observable), `$parent`, `$index` — voir les binds de `block-wysiwyg.tmpl.html`.

## 3. Lire/écrire les champs texte d'un bloc : `block-content-extractor`

`packages/editor/src/js/utils/block-content-extractor.js` — LE module à
réutiliser pour toute feature qui touche au contenu des blocs :

- `extractBlockTranslatableContent(block)` → map plate `{ "titleText": "...", "buttonLink.text": "...", "itemContent.0.title": "..." }` (clés dot-notation).
  Pattern-match des noms de champs texte (`*text`, `*title`, `*label`, `alt`…),
  exclut couleurs/URLs/styles.
- `injectBlockTranslations(blockObservable, map)` → écrit chaque clé via
  `setNestedProperty` (unwrap des observables en chemin, set par appel
  `observable(value)` en feuille). **UI + preview + export se mettent à jour
  seuls.** Générique : fonctionne sur n'importe quel bloc de n'importe quel
  template.

## 4. Undo : transactionnel et déjà branché

- `packages/editor/src/js/undomanager/` observe tout le modèle
  (`ko.watch`, `depth: -1`) : **toute écriture programmatique d'observable est
  capturée**.
- Pour qu'une écriture multi-champs soit annulable en UNE étape :

```js
vm.startMultiple();
try {
  injectBlockTranslations(blockObservable, values);
} finally {
  vm.stopMultiple();
}
```

(pattern de production : `translate-block-modal.js:142-147`). Pas besoin de
snapshot/restore maison.

## 5. Ajouter une action de bloc (bouton au survol)

- Template : `packages/editor/src/tmpl/block-wysiwyg.tmpl.html` — div `.tools`.
  Convention : le bouton **delete reste dernier**. Gating par feature via
  `<!-- ko if: $root.metadata.maFeature -->`.
- Tooltip : garder le couple `title="..."` statique ET
  `attr: { title: $root.t('Ma clé') }` (binding `tooltips: {}` du conteneur) ;
  ajouter la clé dans `public/lang/badsender-fr.js` / `badsender-en.js`
  (fusion dans `mailing.schema.js`, fallback `$root.t` sur la clé sinon).
- Icônes : masques lucide dans `packages/editor/src/css/lucide-icons.less`
  (variable data-URI + classe `.lucide-xxx { .lucide-icon-mask(@lucide-xxx) }`).
  Vérifier que l'icône existe — beaucoup manquent.

## 6. Le flag de feature côté éditeur : `metadata`

- Construit côté serveur dans `MailingSchema.statics.findOneForMosaico`
  (`packages/server/mailing/mailing.schema.js` ~l.448) — ex.
  `hasTranslationFeature` = `aiFeatureService.getActiveFeatureWithIntegration( { groupId, featureType }) && feature.isActive && integration.isActive`.
- Posé tel quel (objet plain, non observable) sur le viewModel par
  `template-loader.js` (~l.554) → utilisable directement dans les bindings :
  `$root.metadata.maFeature`.

## 7. Le pont KO → Vue (modales)

Pattern des modales récentes (`translate-block-modal` = référence) :

1. `viewmodel.js` : une fonction `viewModel.maFeatureBlock(blockData, parent, index)`
   qui unwrap le bloc et appelle `viewModel.toggleMaModal(true, { block, blockObservable, parent, index })`. Déclarer le **placeholder**
   `viewModel.toggleMaModal = ko.observable(null)` (clic avant montage Vue
   inoffensif).
2. Composant Vue dans `packages/editor/src/js/vue/components/<nom>/<nom>.js` :
   prop `vm` (le viewModel KO complet) ; dans `mounted()`, câblage inverse
   `this.vm.toggleMaModal = this.handleToggleModal`. Utiliser le
   `ModalComponent` partagé (`vue/components/modal/`) — pas de less dédié.
3. Enregistrement : `packages/editor/src/js/vue/customizedBlockPlugin.js`
   (require + `components` + tag dans le template). Le point de montage
   `#customizedBlockModal` existe déjà (`tmpl-badsender/toolbox.tmpl.html`).
4. Appels API : helpers d'URL dans `packages/editor/src/js/vue/utils/apis.js`
   (axios, préfixe `/api`, auth par cookie de session).

## 8. ⚠️ Pièges de build (la source n°1 de « ça ne marche pas »)

- **`yarn dev` ne rebuild PAS l'éditeur** (il ne lance que nodemon + maildev).
- Les templates KO (`src/tmpl/*.html`, `src/tmpl-badsender/*.html`) sont
  compilés en `packages/editor/build/templates.js` — **fichier généré, ne
  jamais l'éditer**. Toute modif de template exige `npx gulp templates` (ou un
  build complet).
- Dev continu : `npx gulp dev --watch` (sans `--watch`, le JS n'est pas
  watchifié). One-shot : `yarn editor:build` (= `gulp build`, inclut `rev` qui
  régénère `packages/server/md5public.json` pour le cache-busting).
- Browserify suit le graphe de `require()` : pas de manifest de build à
  déclarer pour un nouveau composant.

## 9. Garde serveur pour les endpoints appelés par l'éditeur

Le routeur `/api/ai-skills` est entièrement **GUARD_ADMIN** : un endpoint
destiné à l'éditeur (utilisateur standard) doit vivre dans son propre routeur
sous **GUARD_USER** (modèle : `packages/server/translation/translation.routes.js`,
monté dans `packages/server/index.js`). GroupId côté serveur :
`req.user.group.id`.
