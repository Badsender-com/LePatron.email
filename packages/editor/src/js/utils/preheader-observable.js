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

  // Not only `preheaderBlock`: a template is free to name its block otherwise, and
  // scanning by property is what makes this survive that. Own keys only, and the
  // first match wins — a template with two would be a template bug, and picking
  // one deterministically beats picking none.
  const keys = Object.keys(root);
  for (let i = 0; i < keys.length; i += 1) {
    const candidate = unwrap(root[keys[i]]);
    if (
      hasOwn(candidate, PREHEADER_PROPERTY) &&
      isObservable(candidate[PREHEADER_PROPERTY])
    ) {
      return {
        observable: candidate[PREHEADER_PROPERTY],
        location: 'block',
        blockName: keys[i],
      };
    }
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
};
