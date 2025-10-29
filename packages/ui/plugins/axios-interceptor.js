/**
 * Axios response interceptor to handle 401 Unauthorized errors
 *
 * When a user's session is invalidated (e.g., due to session replacement),
 * parallel XHR requests may receive 401 errors. This interceptor catches
 * these errors and redirects to the login page, where the logout reason
 * will be displayed if a logout_reason cookie is present.
 */
export default function ({ $axios, redirect }) {
  $axios.onError((error) => {
    const code = parseInt(error.response && error.response.status);

    // Handle 401 Unauthorized errors
    if (code === 401) {
      // Redirect to login page
      // If there's a logout_reason cookie (set by the server),
      // the login page's mounted() hook will read it and display
      // the appropriate message
      redirect('/account/login');
    }
  });
}
