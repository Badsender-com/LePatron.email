Cypress.Commands.add('login', (username, password) => {
  const user = username || Cypress.env('CYPRESS_USER') || 'admin';
  const pass = password || Cypress.env('CYPRESS_PASSWORD') || 'admin';
  const baseUrl = Cypress.env('BASE_URL') || 'http://localhost:3000';

  cy.visit(`${baseUrl}/account/login`);
  // The session cookie is preserved between tests (see support/index.js), so
  // this runs again on an already authenticated browser — where the login page
  // redirects away and its fields never appear. Signing in twice is not an
  // error; assuming a signed-out browser is.
  cy.get('body').then(($body) => {
    if ($body.find('input[name=username]').length === 0) return;
    cy.get('input[name=username]').type(user);
    cy.get('button[type=submit]').click();
    cy.get('input[name=password]').type(pass);
    cy.get('button[type=submit]').click();
  });
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('openEditor', (mailingId) => {
  const id = mailingId || Cypress.env('CYPRESS_MAILING_ID');
  const baseUrl = Cypress.env('BASE_URL') || 'http://localhost:3000';
  if (!id)
    throw new Error(
      'openEditor: mailingId required (CYPRESS_MAILING_ID env variable not set)'
    );
  cy.visit(`${baseUrl}/editor/${id}`);
  // Wait for Knockout bindings to be applied (main panel present)
  cy.get('#page', { timeout: 15000 }).should('exist');
});

// The gallery panel lives behind `ko if: $root.showGallery`, which Mosaico only
// turns on when the author picks an image on a block. Driving that whole path
// would make every gallery spec depend on the block toolbar; flipping the
// observable puts the panel on screen the same way, and the editor loads the
// gallery from its own subscription just as it does for a real user.
//
// Waits on the mount marker rather than on a container: US-04 mounts a single
// `#gallery-panel`, US-05 onwards one host per gallery pane.
Cypress.Commands.add('openGallery', () => {
  cy.get('#page', { timeout: 15000 }).should('exist');
  cy.window().then((win) => {
    const root = win.ko.contextFor(win.document.getElementById('page')).$root;
    root.showGallery(true);
  });
  cy.get('[data-gallery-vue="ready"]', { timeout: 15000 }).should('exist');
});
