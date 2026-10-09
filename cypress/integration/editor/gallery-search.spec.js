/// <reference types="cypress" />

// US-06 — search a gallery by label.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined,
// and a gallery holding a handful of images.

// The editor mounts the panel TWICE — once for the mailing gallery, once for
// the template one (toolbox.tmpl.html). Every selector has to be scoped to one
// of them, or `cy.get` matches both and single-element commands throw.
const PANEL = '#toolimagesgallery';
const SEARCH = `${PANEL} [data-gallery-search]`;
const CLEAR = `${PANEL} .gallery-vue-search__clear`;
const NO_RESULT = `${PANEL} [data-gallery-no-result]`;
const LABEL = `${PANEL} .gallery-thumb__label`;
const COUNT = `${PANEL} .gallery-vue-panel__count`;

// The scroller keeps a pool of recycled views, so the DOM holds labels that are
// no longer part of the list — asserting over every .gallery-thumb__label reads
// stale cells. The cell's data-gallery-index is the handle on real position.
const AT = (index) =>
  `${PANEL} [data-gallery-index="${index}"] .gallery-thumb__label`;

// The search folds diacritics and Unicode normalisation on both sides, so a
// literal `contains` check would fail exactly when the feature works.
const fold = (value) =>
  String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

describe('US-06 — gallery search', () => {
  before(() => {
    cy.login();
    cy.openEditor();
    cy.openGallery();
  });

  beforeEach(() => {
    cy.get(SEARCH).clear();
  });

  it('shows the search box in the gallery panel', () => {
    cy.get(SEARCH).should('exist');
  });

  it('keeps every image when the search is empty', () => {
    cy.get(LABEL).should('have.length.greaterThan', 0);
    cy.get(NO_RESULT).should('not.exist');
  });

  it('narrows the grid to the matching labels', () => {
    // take a real label from the gallery, so the test needs no fixture
    cy.get(AT(0))
      .invoke('text')
      .then((label) => {
        const needle = label
          .trim()
          .split(/[\s.-]/)[0]
          .slice(0, 5);
        cy.get(SEARCH).type(needle);
        cy.get(AT(0))
          .invoke('text')
          .should((text) => {
            expect(fold(text)).to.contain(fold(needle));
          });
      });
  });

  it('matches regardless of case', () => {
    cy.get(AT(0))
      .invoke('text')
      .then((label) => {
        const needle = label
          .trim()
          .split(/[\s.-]/)[0]
          .slice(0, 5);
        cy.get(SEARCH).type(needle.toUpperCase());
        cy.get(LABEL).should('have.length.greaterThan', 0);
      });
  });

  it('matches a label through its accents', () => {
    cy.get(AT(0))
      .invoke('text')
      .then((label) => {
        // fold() strips the accents; typing the folded form must still match
        const needle = fold(label.trim())
          .split(/[\s.-]/)[0]
          .slice(0, 5);
        cy.get(SEARCH).type(needle);
        cy.get(LABEL).should('have.length.greaterThan', 0);
      });
  });

  it('shows a dedicated empty state when nothing matches', () => {
    cy.get(SEARCH).type('zzzz-no-image-carries-this-label');
    cy.get(NO_RESULT).should('be.visible');
    cy.get(LABEL).should('not.exist');
  });

  it('restores the full gallery when the search is cleared', () => {
    cy.get(COUNT)
      .invoke('text')
      .then((fullCount) => {
        cy.get(SEARCH).type('zzzz-no-image');
        cy.get(COUNT).should('not.have.text', fullCount);
        cy.get(CLEAR).click();
        cy.get(COUNT).should('have.text', fullCount);
        cy.get(NO_RESULT).should('not.exist');
      });
  });

  it('gives the field back after clearing', () => {
    cy.get(SEARCH).type('zzzz');
    cy.get(CLEAR).click();
    cy.focused().should('have.attr', 'data-gallery-search');
  });

  // The regression this US could plausibly introduce: searching derives from
  // the Knockout observable rather than replacing it, so Mosaico's own mutation
  // of that list must still reach the grid while a filter is active.
  it('keeps the Knockout gallery as the single source of truth under a filter', () => {
    const NEW_IMAGE = 'zzzz-no-image-test.jpg';

    cy.get(SEARCH).type('zzzz-no-image');
    cy.get(NO_RESULT).should('be.visible');

    cy.get(`${PANEL} .gallery-vue-host`).then(($host) => {
      cy.window().then((win) => {
        // the editor does not publish its viewModel, but Knockout hands back
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
        cy.get(LABEL).should('have.length', 1);

        // and the filter never rewrote the observable itself
        cy.then(() => {
          expect(gallery().length).to.equal(before + 1);
          gallery.shift();
        });
      });
    });
  });
});
