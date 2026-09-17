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
 * One list, because two copies of it drift.
 */
const EDITOR_ONLY_METADATA_KEYS = [
  'urlConverter',
  'template',
  'emailMetadata',
  'emailMetadataConfig',
];

module.exports = { EDITOR_ONLY_METADATA_KEYS };
