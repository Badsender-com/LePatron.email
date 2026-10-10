/// <reference types="cypress" />

// Mosaico non-regression — US-04 Vue gallery infrastructure
// Verifies that injecting the Vue #gallery-panel does not break anything in the editor.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined.

describe('US-04 — Vue gallery infrastructure: Mosaico non-regression', () => {
  // Captures console.error calls emitted while the editor window loads, so the
  // "no critical console errors" test asserts on something real.
  let consoleErrorSpy;

  before(() => {
    cy.login();
    // Register the spy before openEditor() triggers the editor page load.
    cy.on('window:before:load', (win) => {
      consoleErrorSpy = cy.spy(win.console, 'error');
    });
    cy.openEditor();
  });

  describe('Editor loading', () => {
    it('loads without critical console errors', () => {
      cy.get('#page').should('exist');
      cy.then(() => {
        expect(
          consoleErrorSpy,
          'console.error during editor load'
        ).to.have.callCount(0);
      });
    });

    it('mounts a Vue panel in each of the two gallery panes', () => {
      // US-04 mounted a single `#gallery-panel`. Replacing the Knockout grid
      // moves the panel inside each pane instead: one instance for the mailing
      // gallery, one for the template one.
      cy.openGallery();
      cy.get('#toolimagesgallery .gallery-vue-host').should('exist');
      cy.get('#toolimagesgallerytemplate .gallery-vue-host').should('exist');
      cy.get('[data-gallery-vue="ready"]').should('have.length', 2);
      cy.get('#gallery-panel').should('not.exist');
    });
  });

  describe('Critical Mosaico flows', () => {
    it('opens the email gallery panel without error', () => {
      // Gallery open button lives in the Mosaico toolbar
      cy.get('#toolimages').should('exist');
    });

    it('displays email gallery and template gallery tabs', () => {
      // the panes live behind `ko if: $root.showGallery`, so they exist only
      // once the gallery is open
      cy.openGallery();
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
      cy.openGallery();
      cy.get('[data-gallery-vue="ready"]').should('exist');
    });
  });
});
