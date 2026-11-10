/**
 * Axios error handler plugin
 * Handles 401 Unauthorized errors to prevent infinite loops
 * during session replacement
 */

// Module-level flag to prevent multiple redirects
// CRITICAL: Must be module-level, not component-level, to persist across error handler invocations
let isRedirecting = false;

// Whether a request goes to the consent API, under the consent page's path.
function isConsentRequest(url) {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(url, window.location.origin).pathname.startsWith(
      '/oauth/consent/'
    );
  } catch {
    return false;
  }
}

export default function ({ $axios }) {
  $axios.onError((error) => {
    const code = parseInt(error.response && error.response.status);

    // A refusal during the sign-in (the step of the code, ADR 0008) is the
    // login page's to show: the member is not signed in yet.
    const url = (error.config && error.config.url) || '';
    if (url.startsWith('/account/login')) return;
    // So is a refusal of the consent of a connected application (ADR 0012):
    // its page says why, and still lets the user decline. Its URLs are
    // absolute (helpers/api-routes.js).
    if (isConsentRequest(url)) return;

    // Handle 401 Unauthorized errors
    if (code === 401) {
      // SSR safety check
      if (typeof window !== 'undefined' && !isRedirecting) {
        // Set flag to prevent multiple redirects
        isRedirecting = true;

        // Use window.location.href for full page navigation
        // This kills all pending XHR requests and prevents infinite loops
        // DO NOT use router.push or Nuxt redirect() here
        window.location.href = '/account/login';
      }
    }
  });
}
