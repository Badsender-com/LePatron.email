/**
 * Axios response interceptor to handle 401 Unauthorized errors
 *
 * When a user's session is invalidated (e.g., due to session replacement),
 * parallel XHR requests may receive 401 errors. This interceptor catches
 * these errors and redirects to the login page once, where the logout reason
 * will be displayed if a logout_reason cookie is present.
 */

// Flag to prevent multiple redirects
let isRedirecting = false;

export default function ({ $axios }) {
  $axios.onError((error) => {
    const code = parseInt(error.response && error.response.status);

    // Handle 401 Unauthorized errors
    if (code === 401) {
      // Only redirect once, even if multiple 401 errors occur
      if (!isRedirecting && typeof window !== 'undefined') {
        isRedirecting = true;

        // Use window.location.href for a full page redirect
        // This stops all pending XHR requests and prevents infinite loops
        window.location.href = '/account/login';
      }
    }
  });
}
