import isEqual from 'lodash/isEqual';

// Each saved on its own, by its switch (mixin-group-switch.js): never part of
// a save of a settings page, even once the page has learnt their new value.
const SWITCHES_SAVED_APART = ['requireTwoFactor', 'enableMcp', 'allowRetex'];

/**
 * What a settings page of the company sends when it saves: the fields it
 * edits that changed since it loaded the company, compared deep, and only
 * those. A page left open in a tab never sends back what it read, so it never
 * undoes a change made elsewhere since: a module opened, a switch turned off,
 * another page's settings.
 *
 * @param {Object} group the edited company
 * @param {Object} loaded the company as the page loaded or last saved it
 * @param {string[]} [fields] the fields the page edits, all if left out
 * @returns {Object} the changed fields, `{}` when nothing changed
 */
export function changedGroupFields(group, loaded, fields) {
  const sendable = (key) =>
    !SWITCHES_SAVED_APART.includes(key) && (!fields || fields.includes(key));
  return Object.fromEntries(
    Object.keys(group)
      .filter((key) => sendable(key) && !isEqual(group[key], loaded?.[key]))
      .map((key) => [key, group[key]])
  );
}
