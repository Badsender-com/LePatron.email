'use strict';

// Keeps the pasted markup of an "HTML code" block OUT of the export DOM entirely.
//
// Without this, the markup makes a full round trip through the export frame's DOM
// and then through the regex cascade at the end of viewmodel.js exportHTML. That
// round trip is lossy in ways no amount of care in this feature can fix, because
// the cascade is shared with every other block:
//   - the DOM re-serializes it (attribute quoting/casing, implicit <tbody>,
//     entities, void tags closed with `/>`)
//   - `<%`/`%>` come back HTML-escaped and are restored by
//     `/&lt;%.*%&gt;/g` (viewmodel.js:707) — a GREEDY, single-line pattern, so two
//     JSSP tags on one line get decoded as one span, and a multi-line tag is never
//     restored at all
//   - pasted `data-bind`, `<script type="text/html">` and `<!-- ko ... -->` are
//     stripped as if they were Mosaico's own
//
// So during an export the binding renders an inert MARKER instead of the markup,
// registers the raw string here, and the marker is swapped back for those exact
// bytes at the very end of the cascade — after every regex has run. The markup is
// therefore never parsed, never serialized, never pattern-matched.
//
// Scope: this only ever touches the inside of an `lp-html-block` zone. Design
// system blocks and the template markup have no raw source to substitute and keep
// their current behaviour, untouched.

// ASCII, no `<`, `>`, `&`, no non-ASCII: nothing in the cascade can match or
// re-encode it, and the DOM serializes it as-is.
const MARKER_PREFIX = 'LPHTMLBLOCK';

// One session per export. Reset on every begin, so an export that threw halfway
// through cannot leak markers into the next one.
let session = null;

function makeNonce() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

const markerFor = (nonce, index) =>
  '@@' + MARKER_PREFIX + '_' + nonce + '_' + index + '@@';

/**
 * Open a substitution session. Called by exportHTML before the export frame is
 * bound, so every non-wysiwyg render of the block lands in this session.
 */
function beginExportSubstitution() {
  session = { nonce: makeNonce(), items: [] };
}

/**
 * Close the session. After this, the binding renders markup directly again.
 */
function endExportSubstitution() {
  session = null;
}

/**
 * Register raw markup and get the marker to render in its place.
 *
 * Returns null when no export is in progress — the binding then renders the
 * markup as before, so no other rendering path changes behaviour.
 *
 * @param {string} raw
 * @returns {string|null}
 */
function registerMarkup(raw) {
  if (!session) return null;
  const index = session.items.length;
  session.items.push(typeof raw === 'string' ? raw : '');
  return markerFor(session.nonce, index);
}

/**
 * Swap every marker of the current session back for its raw markup.
 *
 * Must run LAST in the export cascade. A replacer FUNCTION is required, not a
 * replacement string: pasted markup routinely contains `$&`, `$1` or `` $` ``,
 * which a string replacement would interpret.
 *
 * @param {string} html
 * @returns {string}
 */
function substituteMarkers(html) {
  if (!session || !html || typeof html !== 'string') return html;
  const pattern = new RegExp(
    '@@' + MARKER_PREFIX + '_' + session.nonce + '_(\\d+)@@',
    'g'
  );
  const items = session.items;
  return html.replace(pattern, (match, index) => {
    const raw = items[Number(index)];
    return typeof raw === 'string' ? raw : '';
  });
}

module.exports = {
  beginExportSubstitution,
  endExportSubstitution,
  registerMarkup,
  substituteMarkers,
  // exposed for tests
  MARKER_PREFIX,
};
