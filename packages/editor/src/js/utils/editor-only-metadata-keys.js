'use strict';

/**
 * Keys of `viewModel.metadata` the editor receives but must never send back.
 *
 * The global save and the personalized-block save both serialise
 * `viewModel.metadata` wholesale (badsender-server-storage.js, viewmodel.js).
 * `updateMosaico` only reads `data`, `name` and `previewHtml`, so sending these
 * changes nothing server-side — but the typology list has no business travelling
 * on every save, and the values are patched through their own route.
 *
 * `headCss` is the value loaded with the mailing, never updated afterwards:
 * the live one is `viewModel.headCss`, which the global save adds on its own
 * (badsender-server-storage.js). Sending the stale copy as well only worked
 * because the live one happened to be spread after it.
 *
 * One list, because two copies of it drift.
 */
const EDITOR_ONLY_METADATA_KEYS = [
  'urlConverter',
  'template',
  'emailMetadata',
  'emailMetadataConfig',
  'headCss',
  // Patched through /quality-ignores, one finding at a time.
  'qualityIgnores',
  // Set by the group and template quality settings, never by the editor.
  'qualitySettings',
];

module.exports = { EDITOR_ONLY_METADATA_KEYS };
