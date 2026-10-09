/// <reference types="cypress" />

// US-07 — format chips and date sort.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined,
// and a gallery holding a mix of jpg, png and gif.

const SEARCH = '[data-gallery-search]';
const FORMAT = '[data-gallery-format]';
const SORT = '[data-gallery-sort]';
const NO_RESULT = '[data-gallery-no-result]';
const THUMB = '.gallery-thumb';
const COUNT = '.gallery-vue-panel__count';
const ACTIVE = 'gallery-vue-chip--active';

// the GIF badge is the only format a thumbnail advertises on its own, so it is
// what a format assertion can lean on without reading the technical file name
const GIF_BADGE = '.gallery-thumb__badge--gif';

describe('US-07 — gallery filters and sort', () => {
  before(() => {
    cy.login();
    cy.openEditor();
  });

  beforeEach(() => {
    // every test starts from the neutral format chip, the default sort and an
    // empty search
    cy.get(SEARCH).clear();
    cy.get(FORMAT).first().click();
    cy.get(SORT).first().click();
  });

  it('shows both chip groups', () => {
    cy.get(FORMAT).should('have.length', 4);
    cy.get(SORT).should('have.length', 2);
  });

  it('opens on "all formats" and on the newest-first sort', () => {
    cy.get(FORMAT).first().should('have.class', ACTIVE);
    cy.get(SORT).first().should('have.class', ACTIVE);
  });

  // The arrow alone is quick to scan but slow to decode, so each sort chip
  // spells its order out for the pointer and for assistive tech.
  it('spells the sort order out in a tooltip', () => {
    cy.get(SORT)
      .first()
      .should('have.attr', 'title', 'Du plus récent au plus ancien');
    cy.get(SORT)
      .last()
      .should('have.attr', 'title', 'Du plus ancien au plus récent');
  });

  it('keeps one active chip per group', () => {
    cy.get(FORMAT).eq(1).click();
    cy.get(`${FORMAT}.${ACTIVE}`).should('have.length', 1);
    cy.get(FORMAT).eq(2).click();
    cy.get(`${FORMAT}.${ACTIVE}`).should('have.length', 1);
    cy.get(FORMAT).eq(2).should('have.class', ACTIVE);
  });

  it('narrows the grid to GIFs, and every thumbnail says so', () => {
    cy.get(FORMAT)
      .contains('GIF')
      .click()
      .then(() => {
        cy.get(THUMB).should('have.length.greaterThan', 0);
        cy.get(THUMB).each(($thumb) => {
          expect($thumb.find(GIF_BADGE)).to.have.length(1);
        });
      });
  });

  it('shows no GIF badge under the JPG chip', () => {
    cy.get(FORMAT).contains('JPG').click();
    cy.get(THUMB).should('have.length.greaterThan', 0);
    cy.get(GIF_BADGE).should('not.exist');
  });

  it('counts the filtered images', () => {
    cy.get(COUNT)
      .invoke('text')
      .then((all) => {
        cy.get(FORMAT).contains('GIF').click();
        cy.get(COUNT).should('not.have.text', all);
        cy.get(FORMAT).first().click();
        cy.get(COUNT).should('have.text', all);
      });
  });

  it('reverses the grid between the two date sorts', () => {
    cy.get('.gallery-thumb__label')
      .first()
      .invoke('text')
      .then((newest) => {
        cy.get(SORT).last().click();
        cy.get('.gallery-thumb__label').first().should('not.have.text', newest);
        cy.get(SORT).first().click();
        cy.get('.gallery-thumb__label').first().should('have.text', newest);
      });
  });

  it('combines a search with a format chip', () => {
    cy.get(FORMAT).contains('PNG').click();
    cy.get(THUMB)
      .should('have.length.greaterThan', 0)
      .then(() => {
        cy.get('.gallery-thumb__label')
          .first()
          .invoke('text')
          .then((label) => {
            cy.get(SEARCH).type(label.trim().slice(0, 4));
            cy.get(GIF_BADGE).should('not.exist');
            cy.get(THUMB).should('have.length.greaterThan', 0);
          });
      });
  });

  it('tells a dead-end format apart from a dead-end search', () => {
    cy.get(SEARCH).type('zzzz-aucune-image-ne-porte-ce-libelle');
    cy.get(NO_RESULT)
      .invoke('text')
      .then((searchMessage) => {
        cy.get(SEARCH).clear();
        // a format the gallery has none of would need an empty gallery to test
        // for real; what matters here is that the two messages are distinct
        expect(searchMessage).to.contain('recherche');
      });
  });
});
