# Plan: Replace Puppeteer preview regeneration with HTML string replacement

## Context

After translating an email, the current flow launches a headless Chrome browser (Puppeteer) to regenerate the `previewHtml`. This takes 30-60 seconds, consumes heavy resources, and is unnecessary: the original mailing already has a valid `previewHtml` in MongoDB, and translation only changes text values from the JSON `data` field. Those exact text values appear verbatim in the rendered HTML — so direct string replacement suffices.

**Note:** Puppeteer itself is still used by `generate-preview.controller.js` for template preview screenshots — it must NOT be removed from `package.json`.

## Approach

For each `originalText → translatedText` pair returned by the translation service:
1. Try direct string replacement in the HTML (handles rich text / body content)
2. Fall back to HTML-encoded replacement (handles `alt`, `title` attribute values)

If `originalMailing.previewHtml` is null/empty, skip silently (`previewGenerated = false`) — same behavior as today when Puppeteer fails.

---

## Files to create / modify / delete

### 1. CREATE `packages/server/translation/preview-html-updater.js`

Pure utility, no external dependencies. Exports one function:

```js
updatePreviewWithTranslations(previewHtml, originalTexts, translations) → string
```

**Logic:**
```
for each key in translations:
  originalText = originalTexts[key]
  translatedText = translations[key]
  if missing or unchanged → skip

  // Pass 1: direct replacement (HTML body content)
  if html.includes(originalText):
    html = html.split(originalText).join(translatedText)
    continue  // avoid double-processing

  // Pass 2: HTML-encoded replacement (attributes: & < > ")
  encodedOriginal = encodeHtmlEntities(originalText)
  if encodedOriginal !== originalText && html.includes(encodedOriginal):
    html = html.split(encodedOriginal).join(encodeHtmlEntities(translatedText))
```

Note: `continue` after pass 1 is critical — prevents double-encoding if translated value contains HTML entities.

---

### 2. MODIFY `packages/server/translation/translation.service.js`

In `translateMailing()`, expose `originalTexts` and `translations` in the return value (currently local variables that are discarded).

**"Nothing to translate" early return** (line ~83):
```js
return {
  mailing,
  stats: { fieldsTranslated: 0, charactersTranslated: 0 },
  originalTexts: textsToTranslate,  // add (empty object)
  translations: {},                  // add
};
```

**Normal return** (line ~117):
```js
return {
  mailing: translatedMailing,
  stats: { ... },
  originalTexts: textsToTranslate,  // add
  translations,                      // add
};
```

Update comment on line ~115: remove mention of Puppeteer.

---

### 3. MODIFY `packages/server/translation/translation.controller.js`

**A. Replace import** (line 7):
```js
// Remove:
const previewGenerator = require('../mailing/preview-generator.service');
// Add:
const { updatePreviewWithTranslations } = require('./preview-html-updater');
```

**B. Remove `cookies`** from `processTranslationAsync` call and from its function signature.

**C. Destructure new fields** from service call:
```js
const { mailing: translatedData, stats, originalTexts, translations } =
  await translationService.translateMailing({ ... });
```

**D. Replace Puppeteer block** with:
```js
translationJobs.setGeneratingPreview(jobId);

let previewGenerated = false;
if (originalMailing.previewHtml) {
  try {
    logger.log(`[Translation] Updating preview HTML via string replacement...`);
    const previewHtml = updatePreviewWithTranslations(
      originalMailing.previewHtml,
      originalTexts,
      translations
    );
    await Mailings.findByIdAndUpdate(duplicatedMailing._id, { previewHtml });
    previewGenerated = true;
    logger.log('[Translation] Preview HTML updated successfully');
  } catch (error) {
    logger.error(`[Translation] Preview update failed: ${error.message}`);
  }
} else {
  logger.log('[Translation] No previewHtml on original mailing, skipping preview update');
}
```

---

### 4. DELETE `packages/server/mailing/preview-generator.service.js`

Only imported by `translation.controller.js`. Once the import is removed, this file is dead code and should be deleted.

---

### 5. MODIFY `packages/editor/src/js/ext/badsender-extensions.js`

Update the comment on lines 88-90 — remove the reference to `preview-generator.service.js` since it no longer exists. The `window.viewModel` exposure itself stays (used by `generate-preview.controller.js` for template thumbnails and potentially other tools).

```js
// Expose viewModel globally for server-side integrations and tooling
customExtensions.push(function exposeViewModel(vm) {
  window.viewModel = vm;
});
```

---

## Files NOT modified

- `packages/server/template/generate-preview.controller.js` — still uses Puppeteer for template screenshots, no change
- `package.json` — Puppeteer dependency is kept (still used by `generate-preview.controller.js`)
- `translation-jobs.js` — no changes needed; `GENERATING_PREVIEW` status is kept (it becomes near-instant but keeps the state machine clean)
- Frontend / UI — no changes needed

---

### 6. CREATE `docs/TRANSLATION_PREVIEW_UPDATER.md`

Document the new approach for future reference (replaces Puppeteer, explains the string replacement strategy and its limitations).

---

## Verification

```bash
# Lint + format
yarn code:fix

# Tests
yarn test

# Manual: trigger a translation job and verify:
# 1. Job completes without the ~60s Puppeteer delay
# 2. The duplicated mailing's previewHtml contains the translated text
# 3. Job status reaches "completed" with previewGenerated: true
# 4. Edge case: mailing with no previewHtml → completes with previewGenerated: false
```
