Cypress.Commands.add('login', (username, password) => {
  const user = username || Cypress.env('CYPRESS_USER') || 'admin';
  const pass = password || Cypress.env('CYPRESS_PASSWORD') || 'admin';
  const baseUrl = Cypress.env('BASE_URL') || 'http://localhost:3000';

  cy.visit(`${baseUrl}/account/login`);
  cy.get('input[name=username]').type(user);
  cy.get('button[type=submit]').click();
  cy.get('input[name=password]').type(pass);
  cy.get('button[type=submit]').click();
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
