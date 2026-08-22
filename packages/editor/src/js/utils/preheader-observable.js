'use strict';

/**
 * Locates the LIVE observable backing the template's preheader property.
 *
 * The panel must not keep its own copy of the preheader, and must not PATCH it.
 * The editor holds the template data in memory and rewrites it wholesale on the
 * global save, so a PATCH would be overwritten at the next save. Binding to the
 * observable the "Preheader" field of Template Options already uses means there
 * is no synchronisation to write: it is the same object, so the two fields cannot
 * disagree.
 *
 * `preheaderText` is a constant name across the client templates, but its location
 * is not — mirroring packages/server/mailing/preheader-resolver.js:
 *
 *   - a template property:  content.preheaderText
 *       (declared `template preheaderText { label: Preheader; }`)
 *   - a block property:     content.preheaderBlock.preheaderText
 *
 * The two must stay in step; if the server resolver gains a location, so must
 * this.
 */

const PREHEADER_PROPERTY = 'preheaderText';
const PREHEADER_BLOCK = 'preheaderBlock';

const isObservable = (value) =>
  typeof value === 'function' && typeof value.subscribe === 'function';

const unwrap = (value) => (isObservable(value) ? value() : value);

const hasOwn = (object, key) =>
  object !== null &&
  typeof object === 'object' &&
  Object.prototype.hasOwnProperty.call(object, key);

/**
 * @param {Object} content the editor's `viewModel.content` (observable or plain)
 * @returns {{observable: Function, location: 'root'|'block', blockName: string|null}|null}
 *   null when the template declares no preheader at all — the panel then disables
 *   the field rather than inventing a property the template never had.
 */
function findPreheaderObservable(content) {
  const root = unwrap(content);
  if (!root || typeof root !== 'object') return null;

  if (hasOwn(root, PREHEADER_PROPERTY) && isObservable(root[PREHEADER_PROPERTY])) {
    return {
      observable: root[PREHEADER_PROPERTY],
      location: 'root',
      blockName: null,
    };
  }

  // `preheaderBlock` by name, and only that name — deliberately narrower than a
  // scan of every block. The server resolver looks the property up by that exact
  // name (preheader-resolver.js), so a preheader found here under any other block
  // would be editable in this panel and invisible to every server-side path: the
  // metadata PATCH, the listing, the export. Two subsystems disagreeing in
  // silence is worse than a template shape we do not support.
  const block = unwrap(root[PREHEADER_BLOCK]);
  if (
    hasOwn(block, PREHEADER_PROPERTY) &&
    isObservable(block[PREHEADER_PROPERTY])
  ) {
    return {
      observable: block[PREHEADER_PROPERTY],
      location: 'block',
      blockName: PREHEADER_BLOCK,
    };
  }

  return null;
}

/**
 * Reads the current preheader, or null when the template has none.
 *
 * @param {Object} content
 * @returns {string|null}
 */
function readPreheader(content) {
  const found = findPreheaderObservable(content);
  if (!found) return null;
  const value = found.observable();
  return typeof value === 'string' ? value : '';
}

module.exports = {
  findPreheaderObservable,
  readPreheader,
  PREHEADER_PROPERTY,
  PREHEADER_BLOCK,
};
