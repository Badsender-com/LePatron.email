import * as apiRoutes from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

/**
 * Load a group from the Nuxt asyncData context, returning `{ group }` for
 * the page data.
 *
 * On error: returns `{ group: {} }` so the page renders without crashing, AND
 * commits an error snackbar through the Vuex page store so the failure is
 * actually visible to the user (the settings pages used to swallow the error
 * with a bare `console.error`, leaving the user staring at an empty form).
 *
 * Designed for the asyncData hook of every page under
 * `routes/groups/_groupId/settings/*`. Pass the full nuxtContext as-is.
 */
export async function safeFetchGroup(nuxtContext) {
  const { $axios, params, store, app } = nuxtContext;

  try {
    const group = await $axios.$get(apiRoutes.groupsItem(params));
    return { group };
  } catch (error) {
    // Surface the failure. Use the i18n key — Nuxt's app.i18n is available in
    // asyncData on both server and client.
    const text =
      (app && app.i18n && app.i18n.t('snackbars.groupFetchError')) ||
      'Unable to load company data';

    if (store && typeof store.commit === 'function') {
      store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
        text,
        color: 'error',
      });
    }

    // Logged in development only — production should rely on Sentry or the
    // server logs; spamming stdout in the browser on every misrouted user
    // request is noise.
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[safeFetchGroup]', error);
    }

    return { group: {} };
  }
}
