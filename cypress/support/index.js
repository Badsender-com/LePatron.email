// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************
import '@testing-library/cypress/add-commands';
import 'cypress-jest-adapter';

import './commands';

// Cypress clears cookies between tests, so a `cy.login()` in a `before()` hook
// only authenticates the first one. Specs whose later tests call the API — a
// rename, an upload — would then see a 401 and read it as a product bug, which
// is exactly what happened while writing the rename spec. Keeping the session
// cookie makes `before()` mean what it looks like it means.
Cypress.Cookies.defaults({ preserve: 'badsender.sid' });
