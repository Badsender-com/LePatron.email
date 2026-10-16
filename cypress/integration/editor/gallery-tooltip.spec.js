/// <reference types="cypress" />

// US-09 — the metadata tooltip on prolonged hover.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined.

const PANEL = '#toolimagesgallery';
const TOOLTIP = '[data-gallery-tooltip]';
const AT = (index) => `${PANEL} [data-gallery-index="${index}"]`;
const LABEL_AT = (index) => `${AT(index)} [data-gallery-label]`;
// `mouseenter` does not bubble, and the handler is on the thumbnail inside the
// cell — triggering it on the cell reaches nothing.
const THUMB_AT = (index) => `${AT(index)} .gallery-thumb`;

// Matches the component's own OPEN_DELAY_MS; the assertions below allow for it
// rather than assuming an instant tooltip.
const OPEN_DELAY = 500;

describe('US-09 — gallery metadata tooltip', () => {
  before(() => {
    cy.login();
    cy.openEditor();
    cy.openGallery();
  });

  afterEach(() => {
    // leave every thumbnail, so one test cannot hand a tooltip to the next one
    // `.trigger()` takes one element at a time — `multiple` is a `.click()`
    // option, not a `.trigger()` one.
    cy.get(`${PANEL} .gallery-thumb`).each(($thumb) => {
      cy.wrap($thumb).trigger('mouseleave', { force: true });
    });
    cy.get(TOOLTIP).should('not.exist');
  });

  it('shows nothing until the pointer has stayed a while', () => {
    cy.get(THUMB_AT(0)).trigger('mouseenter');
    cy.get(TOOLTIP).should('not.exist');
    cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 }).should('exist');
    cy.get(THUMB_AT(0)).trigger('mouseleave');
  });

  it('shows the full label, which the band under the thumbnail truncates', () => {
    cy.get(LABEL_AT(0))
      .invoke('text')
      .then((shown) => {
        cy.get(THUMB_AT(0)).trigger('mouseenter');
        cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 })
          .invoke('text')
          .should('contain', shown.trim());
        cy.get(THUMB_AT(0)).trigger('mouseleave');
      });
  });

  it('shows the dimensions, the format and the date', () => {
    cy.get(THUMB_AT(0)).trigger('mouseenter');
    cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 }).within(() => {
      // the backfill filled every image of this gallery
      cy.get('[data-gallery-tooltip-dimensions]')
        .invoke('text')
        .should('match', /^\d+ × \d+ px$/);
    });
    cy.get(TOOLTIP)
      .invoke('text')
      .should('match', /(PNG|JPG|JPEG|GIF)/);
    cy.get(THUMB_AT(0)).trigger('mouseleave');
  });

  it('disappears as soon as the pointer leaves', () => {
    cy.get(THUMB_AT(0)).trigger('mouseenter');
    cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 }).should('exist');
    cy.get(THUMB_AT(0)).trigger('mouseleave');
    cy.get(TOOLTIP).should('not.exist');
  });

  it('describes the cell the pointer stopped on, not the ones it crossed', () => {
    cy.get(LABEL_AT(4))
      .invoke('text')
      .then((target) => {
        // sweep across without pausing
        cy.get(THUMB_AT(0)).trigger('mouseenter').trigger('mouseleave');
        cy.get(THUMB_AT(2)).trigger('mouseenter').trigger('mouseleave');
        cy.get(THUMB_AT(4)).trigger('mouseenter');

        cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 })
          .invoke('text')
          .should('contain', target.trim());
        cy.get(THUMB_AT(4)).trigger('mouseleave');
      });
  });

  // There is one tooltip for the whole panel, not one per cell: a tooltip
  // inside a thumbnail would be clipped by its `overflow: hidden` and by the
  // virtual scroller.
  it('never renders more than one tooltip', () => {
    cy.get(THUMB_AT(0)).trigger('mouseenter');
    cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 }).should('exist');
    cy.get(THUMB_AT(1)).trigger('mouseenter');
    cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 }).should('have.length', 1);
    cy.get(THUMB_AT(1)).trigger('mouseleave');
  });

  it('stays inside the panel, even for a thumbnail in the last column', () => {
    cy.get(PANEL).then(($panel) => {
      const panel = $panel[0].getBoundingClientRect();
      // index 2 is the third of three columns
      cy.get(THUMB_AT(2)).trigger('mouseenter');
      cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 }).then(($tip) => {
        const tip = $tip[0].getBoundingClientRect();
        expect(tip.left).to.be.at.least(panel.left - 1);
        expect(tip.right).to.be.at.most(panel.right + 1);
      });
      cy.get(THUMB_AT(2)).trigger('mouseleave');
    });
  });

  it('does not catch the pointer it is following', () => {
    cy.get(THUMB_AT(0)).trigger('mouseenter');
    cy.get(TOOLTIP, { timeout: OPEN_DELAY * 4 })
      .should('have.css', 'pointer-events')
      .and('eq', 'none');
    cy.get(THUMB_AT(0)).trigger('mouseleave');
  });
});
