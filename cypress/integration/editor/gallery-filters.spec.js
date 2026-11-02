/// <reference types="cypress" />

// US-07 — format chips and date sort.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined,
// and a gallery holding a mix of jpg, png and gif.

// The editor mounts the panel TWICE — mailing gallery and template gallery
// (toolbox.tmpl.html) — so every selector is scoped to one of them.
const PANEL = '#toolimagesgallery';
const SEARCH = `${PANEL} [data-gallery-search]`;
const FORMAT = `${PANEL} [data-gallery-format]`;
const SORT = `${PANEL} [data-gallery-sort]`;
const THUMB = `${PANEL} .gallery-thumb`;
const COUNT = `${PANEL} .gallery-vue-panel__count`;
const ACTIVE = 'gallery-vue-chip--active';

// The scroller recycles its views, so DOM order is pool order. The cell's
// data-gallery-index is the only reliable handle on list position.
const AT = (index) =>
  `${PANEL} [data-gallery-index="${index}"] .gallery-thumb__label`;

// The GIF badge is the only format a thumbnail advertises on its own, so it is
// what a format assertion can lean on without reading the technical file name.
const GIF_BADGE = `${PANEL} .gallery-thumb__badge--gif`;

describe('US-07 — gallery filters and sort', () => {
  before(() => {
    cy.login();
    cy.openEditor();
    cy.openGallery();
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
  // spells its order out for the pointer and for assistive tech. WCAG 2.5.3
  // also asks that the accessible name contain the visible label.
  it('spells the sort order out, visible label included', () => {
    cy.get(SORT).each(($chip) => {
      const visible = $chip.text().trim();
      expect($chip.attr('title')).to.contain(visible);
      expect($chip.attr('aria-label')).to.contain(visible);
    });
  });

  it('keeps one active chip per group', () => {
    cy.get(FORMAT).eq(1).click();
    cy.get(`${FORMAT}.${ACTIVE}`).should('have.length', 1);
    cy.get(FORMAT).eq(2).click();
    cy.get(`${FORMAT}.${ACTIVE}`).should('have.length', 1);
    cy.get(FORMAT).eq(2).should('have.class', ACTIVE);
  });

  it('narrows the grid to GIFs, and every thumbnail says so', () => {
    cy.get(FORMAT).contains('GIF').click();
    cy.get(THUMB).should('have.length.greaterThan', 0);
    // by index, not by iterating every .gallery-thumb: the scroller's recycled
    // pool holds cells that are no longer part of the list
    [0, 1, 2, 3, 4].forEach((index) => {
      cy.get(`${PANEL} [data-gallery-index="${index}"]`)
        .find('.gallery-thumb__badge--gif')
        .should('have.length', 1);
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
    cy.get(AT(0))
      .invoke('text')
      .then((newest) => {
        cy.get(SORT).last().click();
        cy.get(AT(0)).should('not.have.text', newest);
        cy.get(SORT).first().click();
        cy.get(AT(0)).should('have.text', newest);
      });
  });

  it('combines a search with a format chip', () => {
    cy.get(FORMAT).contains('PNG').click();
    cy.get(AT(0))
      .invoke('text')
      .then((label) => {
        cy.get(SEARCH).type(label.trim().slice(0, 4));
        cy.get(GIF_BADGE).should('not.exist');
        cy.get(THUMB).should('have.length.greaterThan', 0);
      });
  });

  it('keeps the format chip applied while a search is active', () => {
    cy.get(FORMAT).contains('GIF').click();
    cy.get(COUNT)
      .invoke('text')
      .then((gifOnly) => {
        cy.get(SEARCH).type('zzzz-no-image-carries-this-label');
        cy.get(COUNT).should('not.have.text', gifOnly);
        cy.get(SEARCH).clear();
        cy.get(COUNT).should('have.text', gifOnly);
        cy.get(FORMAT).contains('GIF').should('have.class', ACTIVE);
      });
  });
});
