'use strict';

// Flag to prevent multiple redirects when multiple parallel requests fail
let isRedirecting = false;

export default ({ app, error: nuxtError }) => {
  // Register axios response interceptor
  app.$axios.onError((error) => {
    const code = error.response ? error.response.status : null;

    // Handle 401 Unauthorized errors (session invalidated)
    if (code === 401) {
      // Only redirect once, even if multiple parallel requests fail
      if (!isRedirecting) {
        isRedirecting = true;

        // Use window.location.href for full page navigation
        // This kills all pending XHR requests, preventing infinite loops
        // Framework redirects (router.push, redirect()) don't stop pending requests
        if (process.client) {
          window.location.href = '/account/login';
        }
      }
    }

    // Reset flag after a delay to allow for legitimate redirects later
    // (e.g., if user logs in again)
    if (process.client) {
      setTimeout(() => {
        isRedirecting = false;
      }, 2000);
    }

    // Return the error to allow other error handlers to process it
    return Promise.reject(error);
  });
};
