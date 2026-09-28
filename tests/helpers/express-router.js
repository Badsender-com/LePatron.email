'use strict';

/**
 * Reading guards off a real express router.
 *
 * Route protection is one word per line in a routes file, and nothing else in
 * the codebase notices a route losing its guard. These helpers let a test assert
 * the guards by identity on the actual express stack rather than on source text,
 * so a renamed or reordered middleware cannot pass unnoticed.
 *
 * Express keeps one layer per `router.<method>()` call; `route.stack` holds the
 * handlers of that layer, guards first, controller last.
 */

/**
 * @param {Object} router an express Router
 * @param {string} method lowercase, eg. `get`
 * @param {string} path as declared, eg. `/:itemId`
 * @returns {Object} the express layer
 * @throws when no such route is declared — the message names the route, so a
 *   missing declaration reads as itself rather than as `undefined.route`.
 */
function layerFor(router, method, path) {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route?.path === path && candidate.route.methods[method]
  );
  if (!layer) {
    throw new Error(`no ${method.toUpperCase()} ${path} route declared`);
  }
  return layer;
}

/**
 * @returns {Function[]} the middlewares guarding the route, controller excluded.
 */
function guardsOf(router, method, path) {
  return layerFor(router, method, path)
    .route.stack.map((handler) => handler.handle)
    .slice(0, -1);
}

/**
 * Bind both helpers to one router, so a test file reads
 * `guardsOf('get', '/x')` instead of repeating the router on every line.
 *
 * @param {Object} router
 * @returns {{ layerFor: Function, guardsOf: Function }}
 */
function routeInspector(router) {
  return {
    layerFor: (method, path) => layerFor(router, method, path),
    guardsOf: (method, path) => guardsOf(router, method, path),
  };
}

module.exports = { layerFor, guardsOf, routeInspector };
