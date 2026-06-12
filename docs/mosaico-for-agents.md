# Mosaico for agents — editor golden patterns

> Capitalized from the textgen POC Phase 0 exploration (2026-06). The editor
> (`packages/editor/`) is a **Mosaico fork**: Knockout.js for the model,
> TinyMCE 4.5.8 inline for rich text, a **Vue 2** layer for recent modals, all
> built by **gulp + browserify** (not by Nuxt). This doc lists the safe
> patterns and known traps for working inside it.

## 1. The rich-text editor is TinyMCE (not FCKeditor)

- KO ↔ TinyMCE binding: `packages/editor/src/js/bindings/wysiwygs.js`
  (`tinymce.init` ~l.606, `inline: true` mode).
- Two-way sync: `change redo undo` events → `value(editor.getContent())`;
  a `ko.computed` → `setContent()` when the observable changes elsewhere.
- Consequence: **writing into the observable is enough** — TinyMCE, the
  preview and the HTML export all follow. Never drive TinyMCE directly to
  inject content.

## 2. Accessing the viewmodel and the blocks

- Structure: `viewModel.content().mainBlocks().blocks()` (observableArray of
  blocks).
- Selected block: `viewModel.selectedBlock()` (`viewmodel.js:47`).
- **Every scalar property of a block is a `ko.observable`, including `type`**
  (generic wrapper in `converter/wrapper.js`). In a binding:
  `ko.utils.unwrapObservable($data.type)` — never `$data.type == 'x'`.
- From a block tool button, the KO context provides `$rawData` (the block
  observable), `$parent` and `$index` — see the binds in
  `block-wysiwyg.tmpl.html`.

## 3. Reading/writing a block's text fields: `block-content-extractor`

`packages/editor/src/js/utils/block-content-extractor.js` — THE module to
reuse for any feature that touches block content:

- `extractBlockTranslatableContent(block)` → flat map `{ "titleText": "...", "buttonLink.text": "...", "itemContent.0.title": "..." }` (dot-notation
  keys). Pattern-matches text field names (`*text`, `*title`, `*label`,
  `alt`…), excludes colors/URLs/styles.
- `injectBlockTranslations(blockObservable, map)` → writes each key through
  `setNestedProperty` (unwraps observables along the path, sets the leaf by
  calling `observable(value)`). **UI + preview + export update on their
  own.** Generic: works on any block of any template.

## 4. Undo: transactional and already wired

- `packages/editor/src/js/undomanager/` watches the whole model
  (`ko.watch`, `depth: -1`): **every programmatic observable write is
  captured**.
- To make a multi-field write revert in ONE step:

```js
vm.startMultiple();
try {
  injectBlockTranslations(blockObservable, values);
} finally {
  vm.stopMultiple();
}
```

(production pattern: `translate-block-modal.js:142-147`). No home-made
snapshot/restore needed.

## 5. Adding a block action (hover toolbar button)

- Template: `packages/editor/src/tmpl/block-wysiwyg.tmpl.html` — the `.tools`
  div. Convention: the **delete button stays last**. Feature-gate with
  `<!-- ko if: $root.metadata.myFeature -->`.
- Tooltip: keep both the static `title="..."` AND
  `attr: { title: $root.t('My key') }` (the container's `tooltips: {}`
  binding); add the key to `public/lang/badsender-fr.js` /
  `badsender-en.js` (merged in `mailing.schema.js`; `$root.t` falls back to
  the key otherwise).
- Icons: lucide masks in `packages/editor/src/css/lucide-icons.less`
  (data-URI variable + `.lucide-xxx { .lucide-icon-mask(@lucide-xxx) }`
  class). Check the icon exists — many are missing.

## 6. The editor-side feature flag: `metadata`

- Built server-side in `MailingSchema.statics.findOneForMosaico`
  (`packages/server/mailing/mailing.schema.js` ~l.448) — e.g.
  `hasTranslationFeature` = `aiFeatureService.getActiveFeatureWithIntegration( { groupId, featureType }) && feature.isActive && integration.isActive`.
- Set as-is (plain object, not observable) on the viewModel by
  `template-loader.js` (~l.554) → usable directly in bindings:
  `$root.metadata.myFeature`.

## 7. The KO → Vue bridge (modals)

Pattern of the recent modals (`translate-block-modal` = the reference):

1. `viewmodel.js`: a `viewModel.myFeatureBlock(blockData, parent, index)`
   function that unwraps the block and calls `viewModel.toggleMyModal(true, { block, blockObservable, parent, index })`. Declare the **placeholder**
   `viewModel.toggleMyModal = ko.observable(null)` (a click before the Vue
   mount is harmless).
2. Vue component in `packages/editor/src/js/vue/components/<name>/<name>.js`:
   `vm` prop (the full KO viewModel); in `mounted()`, the reverse wiring
   `this.vm.toggleMyModal = this.handleToggleModal`. Use the shared
   `ModalComponent` (`vue/components/modal/`) — no dedicated less needed.
3. Registration: `packages/editor/src/js/vue/customizedBlockPlugin.js`
   (require + `components` + tag in the template). The mount node
   `#customizedBlockModal` already exists (`tmpl-badsender/toolbox.tmpl.html`).
   ⚠️ Resolution happens through the GLOBAL `Vue.component('Name', …)` name,
   which must camelize-match the kebab tag exactly: `<textgen-block-modal>`
   resolves to `'TextgenBlockModal'` (lowercase "gen"), NOT
   `'TextGenBlockModal'` — a mismatch fails at runtime with
   "Unknown custom element" and the click is silently absorbed by the KO
   placeholder.
4. API calls: URL helpers in `packages/editor/src/js/vue/utils/apis.js`
   (axios, `/api` prefix, session-cookie auth).

## 8. ⚠️ Build traps (the #1 source of "it doesn't work")

- **`yarn dev` does NOT rebuild the editor** (it only runs nodemon + maildev).
- KO templates (`src/tmpl/*.html`, `src/tmpl-badsender/*.html`) are compiled
  into `packages/editor/build/templates.js` — **generated file, never edit
  it**. Any template change requires `npx gulp templates` (or a full build).
- Continuous dev: `npx gulp dev --watch` (without `--watch` the JS is not
  watchified). One-shot: `yarn editor:build` (= `gulp build`, includes `rev`
  which regenerates `packages/server/md5public.json` for cache-busting).
- Browserify follows the `require()` graph: no build manifest to declare for
  a new component.

## 9. Server guard for editor-facing endpoints

The `/api/ai-skills` router is entirely **GUARD_ADMIN**: an endpoint meant for
the editor (standard users) must live in its own router under **GUARD_USER**
(model: `packages/server/translation/translation.routes.js`, mounted in
`packages/server/index.js`). Server-side groupId: `req.user.group.id`.
