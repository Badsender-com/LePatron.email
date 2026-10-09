/// <reference types="cypress" />

// US-11 — renaming a gallery image from its thumbnail.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined,
// and a gallery holding at least one image.

// The editor mounts the panel twice — mailing gallery and template gallery —
// so every selector is scoped to one of them.
const PANEL = '#toolimagesgallery';
const SEARCH = `${PANEL} [data-gallery-search]`;
const INPUT = `${PANEL} [data-gallery-label-input]`;
const COUNT = `${PANEL} .gallery-vue-panel__count`;

// The scroller recycles its views, so DOM order is pool order: the cell index
// is the only reliable handle on position.
const AT = (index) => `${PANEL} [data-gallery-index="${index}"]`;
const LABEL_AT = (index) => `${AT(index)} [data-gallery-label]`;

describe('US-11 — rename a gallery image', () => {
  let original;
  // Unique per run: the component sends nothing when the label comes back
  // unchanged, so a fixed name silently turns into a no-op the moment a run
  // leaves it behind in the database.
  const SEARCHABLE = `zzgallery${Date.now()}.png`;

  before(() => {
    cy.login();
    cy.openEditor();
    cy.openGallery();
    // remember the first image's label so each test can put it back
    cy.get(LABEL_AT(0))
      .invoke('text')
      .then((text) => {
        original = text.trim();
      });
  });

  beforeEach(() => {
    // The rename is optimistic: the label changes before the server answers,
    // and goes back if it refuses. Asserting without waiting for the round-trip
    // races it, and reads whichever of the two the test happened to catch.
    cy.intercept('PATCH', '/api/images/gallery/**').as('rename');
    cy.get(SEARCH).clear();
  });

  afterEach(() => {
    // a test may have left the editor open, and the input replaces the label
    cy.get(PANEL).then(($panel) => {
      if ($panel.find('[data-gallery-label-input]').length) {
        cy.get(INPUT).type('{esc}');
      }
    });
    // leave the gallery as we found it, whatever the test did
    cy.get(LABEL_AT(0))
      .invoke('text')
      .then((text) => {
        if (text.trim() === original) return;
        cy.get(LABEL_AT(0)).dblclick();
        cy.get(INPUT).clear().type(`${original}{enter}`);
        cy.get(LABEL_AT(0)).should('have.text', original);
        // the next test must not catch this restore's response
        cy.wait('@rename');
      });
  });

  it('shows an input in place of the label on double-click', () => {
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).should('exist').and('have.value', original);
  });

  it('does not insert the image when the label is double-clicked', () => {
    // a single click anywhere on a thumbnail inserts the image into the block,
    // so the label band has to stop the click from reaching the thumbnail
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).should('exist');
    cy.get('#main-wysiwyg-area').should('exist');
  });

  it('saves on Enter and shows the new label', () => {
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).clear().type('renomme par cypress.png{enter}');
    cy.wait('@rename').its('response.statusCode').should('eq', 200);
    cy.get(LABEL_AT(0)).should('have.text', 'renomme par cypress.png');
  });

  it('saves on blur', () => {
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).clear().type('renomme au focus.png').blur();
    cy.wait('@rename').its('response.statusCode').should('eq', 200);
    cy.get(LABEL_AT(0)).should('have.text', 'renomme au focus.png');
  });

  it('drops the change on Escape', () => {
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).clear().type('jamais enregistre.png{esc}');
    cy.get(LABEL_AT(0)).should('have.text', original);
  });

  it('refuses an empty label', () => {
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).clear().type('   {enter}');
    cy.get(LABEL_AT(0)).should('have.text', original);
  });

  // The label is what the search matches on, so a rename has to change what
  // the image answers to — without a reload.
  it('makes the image findable under its new label straight away', () => {
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).should('exist').clear().type(`${SEARCHABLE}{enter}`);
    cy.wait('@rename').its('response.statusCode').should('eq', 200);
    cy.get(LABEL_AT(0)).should('have.text', SEARCHABLE);

    cy.get(SEARCH).type(SEARCHABLE.replace('.png', ''));
    cy.get(LABEL_AT(0)).should('have.text', SEARCHABLE);
    // The scroller keeps a pool of rendered views, so the DOM holds cells that
    // left the list: count what the panel reports, and check the second slot is
    // gone rather than counting .gallery-thumb.
    cy.get(COUNT).should('contain', '1');
    cy.get(AT(1)).should('not.exist');
    cy.get(SEARCH).clear();
  });

  it('keeps the new label after the gallery is reloaded', () => {
    cy.get(LABEL_AT(0)).dblclick();
    cy.get(INPUT).clear().type('persiste apres rechargement.png{enter}');
    cy.wait('@rename').its('response.statusCode').should('eq', 200);
    cy.get(LABEL_AT(0)).should('have.text', 'persiste apres rechargement.png');

    cy.reload();
    cy.openGallery();
    cy.get(LABEL_AT(0)).should('have.text', 'persiste apres rechargement.png');
  });

  it('opens the editor from the keyboard too', () => {
    // a double-click cannot be performed on a keyboard; the band is focusable
    // and Enter opens the same editor
    cy.get(LABEL_AT(0)).focus().type('{enter}');
    cy.get(INPUT).should('exist');
    cy.get(INPUT).type('{esc}');
  });
});
