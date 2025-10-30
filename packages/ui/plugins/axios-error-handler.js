'use strict';

// Flag to prevent multiple redirects when multiple parallel requests fail
let isRedirecting = false;
// Track successful login to ignore 401 errors temporarily after login
let lastSuccessfulLoginTime = 0;
const LOGIN_GRACE_PERIOD_MS = 3000; // 3 seconds grace period after login

export default ({ app, error: nuxtError }) => {
  // Register axios response interceptor
  app.$axios.onError((error) => {
    const code = error.response ? error.response.status : null;

    // Handle 401 Unauthorized errors (session invalidated)
    if (code === 401) {
      // Don't redirect if we're already on the login page
      // This prevents infinite loops during login process
      if (process.client) {
        const currentPath = window.location.pathname;
        if (currentPath === '/account/login' || currentPath.startsWith('/account/login')) {
          return Promise.reject(error);
        }

        // Don't redirect if the failed request is to the login endpoint itself
        // This can happen during login attempts with invalid credentials
        const requestUrl = error.config?.url || '';
        if (requestUrl.includes('/account/login')) {
          return Promise.reject(error);
        }

        // Ignore 401 errors for a short period after successful login
        // This handles race conditions where parallel requests use old session cookies
        const timeSinceLogin = Date.now() - lastSuccessfulLoginTime;
        if (timeSinceLogin < LOGIN_GRACE_PERIOD_MS) {
          return Promise.reject(error);
        }
      }

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

  // Track successful login responses to enable grace period
  app.$axios.interceptors.response.use(
    (response) => {
      // If this is a successful POST to /account/login, update grace period
      const config = response.config;
      if (
        config &&
        config.method === 'post' &&
        config.url &&
        config.url.includes('/account/login') &&
        response.status === 200 &&
        process.client
      ) {
        lastSuccessfulLoginTime = Date.now();
      }
      return response;
    },
    (error) => {
      // Error handling is done in onError, so we just pass through
      return Promise.reject(error);
    }
  );
};
