// What the page of one skill or expertise answers when what it loads fails:
// "not found" only when the item's own API says so. Any other failure keeps
// its status and message, and is logged, on the server during a server-side
// render: a page that hides it behind a 404 cannot be diagnosed.

const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const ITEM_LOAD = Symbol('itemLoad');

/**
 * Marks a failure as the item's own load, the only one that may say the
 * item does not exist: `$axios.$get(url).catch(itemLoadFailed)`.
 *
 * @param {Error} err
 * @throws {Error} the same error, marked
 */
export function itemLoadFailed(err) {
  if (err && typeof err === 'object') err[ITEM_LOAD] = true;
  throw err;
}

/**
 * @param {Error} err what the page's loads threw
 * @param {string} notFoundMessage what the page says of an item that does
 *   not exist
 * @returns {{ statusCode: number, message: string }} for Nuxt's `error`
 */
export function pageLoadError(err, notFoundMessage) {
  const response = (err && err.response) || {};
  const status = response.status;
  if (err && err[ITEM_LOAD] && status === NOT_FOUND) {
    return { statusCode: NOT_FOUND, message: notFoundMessage };
  }
  // eslint-disable-next-line no-console
  console.error('[page load]', err);
  const sent = response.data && response.data.message;
  return {
    statusCode: status || SERVER_ERROR,
    message: sent || (err && err.message) || 'Error',
  };
}
