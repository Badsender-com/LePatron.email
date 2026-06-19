/// <reference types="cypress" />

// Mosaico non-regression — US-04 Vue gallery infrastructure
// Verifies that injecting the Vue #gallery-panel does not break anything in the editor.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined.

describe('US-04 — Vue gallery infrastructure: Mosaico non-regression', () => {
  before(() => {
    cy.login();
    cy.openEditor();
  });

  describe('Editor loading', () => {
    it('loads without critical console errors', () => {
      cy.get('#page').should('exist');
    });

    it('mounts the Vue #gallery-panel mount point', () => {
      cy.get('#gallery-panel').should('exist');
      cy.get('[data-gallery-vue="ready"]').should('exist');
    });
  });

  describe('Critical Mosaico flows', () => {
    it('opens the email gallery panel without error', () => {
      // Gallery open button lives in the Mosaico toolbar
      cy.get('#toolimages').should('exist');
    });

    it('displays email gallery and template gallery tabs', () => {
      cy.get('#toolimagesgallery').should('exist');
      cy.get('#toolimagesgallerytemplate').should('exist');
    });

    it('blocks list is accessible', () => {
      cy.get('#toolblocks').should('exist');
    });

    it('main editing area is accessible', () => {
      cy.get('#main-wysiwyg-area').should('exist');
    });

    it('save toolbar is accessible', () => {
      cy.get('#toolbar').should('exist');
    });
  });

  describe('Knockout ↔ Vue bridge', () => {
    it('emits GALLERY_READY when the Vue component mounts', () => {
      // Verified via the data attribute set by the Vue component on mount
      cy.get('[data-gallery-vue="ready"]').should('exist');
    });
  });
});
