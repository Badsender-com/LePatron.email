/**
 * Axios error handler plugin
 * Handles 401 Unauthorized errors to prevent infinite loops
 * during session replacement
 */

// Module-level flag to prevent multiple redirects
// CRITICAL: Must be module-level, not component-level, to persist across error handler invocations
let isRedirecting = false;

export default function ({ $axios, redirect }) {
  $axios.onError((error) => {
    const code = parseInt(error.response && error.response.status);

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
