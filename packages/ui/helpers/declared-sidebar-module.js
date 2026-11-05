/**
 * The sidebar module a page declares in its `meta` option, for a page whose
 * path names no module (the global admin pages, such as /ai-skills).
 *
 * Nuxt 2 hands the pages' `meta` to the middleware only (`context.route.meta`):
 * `$route.meta` is the router's, always empty here. It is read from the
 * components the route matched, which are resolved once the route is entered.
 *
 * @param {import('vue-router').Route} route
 * @returns {string|undefined}
 */
export function declaredSidebarModule(route) {
  return (route?.matched || [])
    .flatMap((record) => Object.values(record.components || {}))
    .map((component) => (component?.options || component)?.meta)
    .map((meta) => meta && meta.sidebarModule)
    .find(Boolean);
}
