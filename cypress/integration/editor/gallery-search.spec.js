/// <reference types="cypress" />

// US-06 — search a gallery by label.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined,
// and a gallery holding at least a handful of images.

const SEARCH = '[data-gallery-search]';
const NO_RESULT = '[data-gallery-no-result]';
const THUMB_LABEL = '.gallery-thumb__label';
const COUNT = '.gallery-vue-panel__count';

describe('US-06 — gallery search', () => {
  before(() => {
    cy.login();
    cy.openEditor();
  });

  beforeEach(() => {
    // every test starts from the full gallery
    cy.get(SEARCH).clear();
  });

  it('shows the search box in the gallery panel', () => {
    cy.get('#toolimagesgallery').find(SEARCH).should('exist');
  });

  it('keeps every image when the search is empty', () => {
    cy.get(THUMB_LABEL).should('have.length.greaterThan', 0);
    cy.get(NO_RESULT).should('not.exist');
  });

  it('narrows the grid to the matching labels', () => {
    // take a real label from the gallery, so the test does not depend on fixtures
    cy.get(THUMB_LABEL)
      .first()
      .invoke('text')
      .then((label) => {
        const needle = label.trim().slice(0, 4);
        cy.get(SEARCH).type(needle);
        cy.get(THUMB_LABEL).each(($el) => {
          expect($el.text().toLowerCase()).to.contain(needle.toLowerCase());
        });
      });
  });

  it('matches regardless of case', () => {
    cy.get(THUMB_LABEL)
      .first()
      .invoke('text')
      .then((label) => {
        const needle = label.trim().slice(0, 4);
        cy.get(SEARCH).type(needle.toUpperCase());
        cy.get(THUMB_LABEL).should('have.length.greaterThan', 0);
      });
  });

  it('shows a dedicated empty state when nothing matches', () => {
    cy.get(SEARCH).type('zzzz-aucune-image-ne-porte-ce-libelle');
    cy.get(NO_RESULT).should('be.visible');
    cy.get(THUMB_LABEL).should('not.exist');
  });

  it('restores the full gallery when the search is cleared', () => {
    cy.get(COUNT)
      .invoke('text')
      .then((fullCount) => {
        cy.get(SEARCH).type('zzzz-aucune-image');
        cy.get(COUNT).should('not.have.text', fullCount);
        cy.get('.gallery-vue-search__clear').click();
        cy.get(COUNT).should('have.text', fullCount);
        cy.get(NO_RESULT).should('not.exist');
      });
  });

  it('counts the filtered images, not the whole gallery', () => {
    cy.get(COUNT)
      .invoke('text')
      .then((fullCount) => {
        cy.get(SEARCH).type('zzzz-aucune-image');
        cy.get(COUNT).should('contain', '0');
        cy.get(COUNT).should('not.have.text', fullCount);
      });
  });

  // The regression this US could plausibly introduce: searching derives from
  // the Knockout observable rather than replacing it, so Mosaico's own mutation
  // of that list must still reach the grid while a filter is active.
  it('keeps the Knockout gallery as the single source of truth under an active filter', () => {
    const NEW_IMAGE = 'zzzz-aucune-image-test.jpg';

    cy.get(SEARCH).type('zzzz-aucune-image');
    cy.get(NO_RESULT).should('be.visible');

    cy.get('#toolimagesgallery .gallery-vue-host').then(($host) => {
      cy.window().then((win) => {
        // the editor does not publish its viewModel, but Knockout can hand back
        // the root binding context of any bound element
        const root = win.ko.contextFor($host[0]).$root;
        const gallery = root.mailingGallery;
        const before = gallery().length;

        // simulate what an upload does: Mosaico unshifts into the observable
        gallery.unshift({
          name: NEW_IMAGE,
          url: NEW_IMAGE,
          deleteUrl: `/api/images/${NEW_IMAGE}`,
          thumbnailUrl: `/api/images/cover/111x111/${NEW_IMAGE}`,
          label: NEW_IMAGE,
        });

        // the new image matches the active search, so it must show up
        cy.get(NO_RESULT).should('not.exist');
        cy.get(THUMB_LABEL).should('have.length', 1);

        // and the filter never rewrote the observable itself
        cy.then(() => {
          expect(gallery().length).to.equal(before + 1);
          gallery.shift();
        });
      });
    });
  });
});
