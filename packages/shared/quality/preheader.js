'use strict';

// Where a template declares its preheader: at the root (`preheaderText`) or in
// a root-level `preheaderBlock` (docs/TEMPLATE_DEVELOPER_GUIDE.md, preheader).
// The editor's quality control and the share page read it the same way: the
// first path that holds a string, nothing when the template turned it off.
const PREHEADER_PATHS = Object.freeze([
  Object.freeze(['preheaderText']),
  Object.freeze(['preheaderBlock', 'preheaderText']),
]);

function valueAt(data, path) {
  return path.reduce(
    (node, key) => (node && typeof node === 'object' ? node[key] : undefined),
    data
  );
}

// The preheader text of a template's content, trimmed, or '' when there is
// none or the template turned it off.
function preheaderOf(data) {
  if (!data || data.preheaderVisible === false) return '';
  const value = PREHEADER_PATHS.map((path) => valueAt(data, path)).find(
    (candidate) => typeof candidate === 'string'
  );
  return value ? value.trim() : '';
}

module.exports = { PREHEADER_PATHS, preheaderOf };
