/// <reference types="cypress" />

// US-08 + US-10 — the actions revealed on a thumbnail at hover, and the one
// that reopens the image editor.
// Prerequisites: server running + CYPRESS_MAILING_ID env variable defined,
// and a gallery holding at least two images.

// The editor mounts the panel twice — mailing gallery and template gallery —
// so every selector is scoped to one of them.
const PANEL = '#toolimagesgallery';
const COUNT = `${PANEL} .gallery-vue-panel__count`;
const SEARCH = `${PANEL} [data-gallery-search]`;

// The scroller recycles its views, so DOM order is pool order: the cell index
// is the only reliable handle on position.
const AT = (index) => `${PANEL} [data-gallery-index="${index}"]`;
const LABEL_AT = (index) => `${AT(index)} [data-gallery-label]`;
const OVERLAY_AT = (index) => `${AT(index)} [data-gallery-overlay]`;
const EDIT_AT = (index) => `${AT(index)} [data-gallery-edit]`;
const RENAME_AT = (index) => `${AT(index)} [data-gallery-rename]`;
const REMOVE_AT = (index) => `${AT(index)} [data-gallery-remove]`;

// The Konva editor appends itself to document.body, outside the panel.
const EDITOR = '#editor-wrapper';
const EDITOR_SAVE = `${EDITOR} .js-actions-submit`;
const EDITOR_CANCEL = `${EDITOR} .js-actions-cancel.editor-button-secondary`;

describe('US-08 — the actions on a thumbnail', () => {
  before(() => {
    cy.login();
    cy.openEditor();
    cy.openGallery();
  });

  afterEach(() => {
    // The overlay is also revealed by `:focus-within`, so a test that leaves
    // focus inside a thumbnail would hand the next one a cell already open.
    cy.document().then((doc) => {
      if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
    });
  });

  // NOTE ON HOVER. The reveal is pure CSS — `.gallery-thumb:hover` — and
  // deliberately so: the story asks for no re-render per hover, and the
  // thumbnail is one of twenty live cells in a recycling scroller. But
  // `:hover` is a state of the real pointer, not an event, and Cypress cannot
  // produce it: `.trigger('mouseenter')` dispatches a DOM event, which is why
  // the US-09 tooltip can be driven that way (a Vue handler listens for it)
  // and this cannot. Asserting a reveal after a synthetic mouseenter only
  // ever tested the test.
  //
  // So what follows pins the parts that do not need a pointer: the resting
  // state, the rule that performs the reveal, the keyboard path, and — the
  // one that actually guards a regression — the fact that the scrim never
  // takes the pointer at all.
  it('keeps the actions out of the way until the pointer arrives', () => {
    cy.get(OVERLAY_AT(0)).should('have.css', 'opacity', '0');
  });

  it('carries the rule that reveals them, for hover and for focus alike', () => {
    cy.document().then((doc) => {
      const rules = [];
      Array.from(doc.styleSheets).forEach((sheet) => {
        let own;
        try {
          own = sheet.cssRules;
        } catch (e) {
          return; // a cross-origin stylesheet, none of ours
        }
        Array.from(own || []).forEach((rule) => {
          if (rule.selectorText && rule.style && rule.style.opacity === '1') {
            rules.push(rule.selectorText);
          }
        });
      });
      const reveals = rules.filter((selector) =>
        selector.includes('.gallery-thumb__overlay')
      );
      expect(reveals.join(' | ')).to.contain(':hover');
      expect(reveals.join(' | ')).to.contain(':focus-within');
    });
  });

  // A control that is focusable but invisible is worse than one that is
  // neither: a keyboard user would be tabbing through buttons they cannot
  // see. `.focus()` sets the real focus state, so this one is honest.
  it('shows them when a button inside takes focus', () => {
    cy.get(OVERLAY_AT(0)).should('have.css', 'opacity', '0');
    cy.get(RENAME_AT(0)).focus();
    cy.get(OVERLAY_AT(0)).should('have.css', 'opacity', '1');
    cy.get(RENAME_AT(0)).blur();
    cy.get(OVERLAY_AT(0)).should('have.css', 'opacity', '0');
  });

  // ADR-0005: the overlay lives in the image area and never covers the label
  // band, which is what a rename has to double-click.
  it('never covers the label band', () => {
    cy.get(LABEL_AT(0)).then(($label) => {
      const band = $label[0].getBoundingClientRect();
      cy.get(OVERLAY_AT(0)).then(($overlay) => {
        expect($overlay[0].getBoundingClientRect().bottom).to.be.at.most(
          band.top + 1
        );
      });
    });
  });

  // The invariant the drag depends on, and the reason it survives: the scrim
  // spans the image area but never takes the pointer — not even while it is
  // visible, which is where the reference mockup differs. Only the small bar
  // takes it back. jQuery UI's draggable refuses to start from a button, so
  // a scrim that accepted the pointer would have made the thumbnail
  // undraggable exactly while the user could see it.
  it('never lets the scrim take the pointer', () => {
    // The scrim never takes it, shown or hidden. The bar takes it only once
    // the overlay is revealed — at rest it is `none` too, so a touch tap at
    // the bottom-centre of a thumbnail cannot hit an invisible button.
    cy.get(OVERLAY_AT(0)).should('have.css', 'pointer-events', 'none');
    cy.get(`${AT(0)} .gallery-thumb__actions`).should(
      'have.css',
      'pointer-events',
      'none'
    );
    // revealed by focus (the one state Cypress can set), the bar is a target
    cy.get(RENAME_AT(0)).focus();
    cy.get(`${AT(0)} .gallery-thumb__actions`).should(
      'have.css',
      'pointer-events',
      'auto'
    );
    cy.get(RENAME_AT(0)).blur();
  });

  it('can still be dragged onto the email from its image area', () => {
    cy.get(`${AT(0)} .gallery-thumb__img`).then(($image) => {
      const box = $image[0].getBoundingClientRect();
      // the foot of the image area, where the action bar sits: the drag has
      // to start even from the scrim right behind it
      const x = box.left + box.width / 2;
      const y = box.bottom - 8;

      // jQuery UI reads pageX/pageY, not clientX/clientY: a drag driven by
      // the latter never starts, and the test passes for the wrong reason.
      cy.wrap($image)
        .trigger('mousedown', { which: 1, button: 0, pageX: x, pageY: y })
        .trigger('mousemove', {
          which: 1,
          button: 0,
          pageX: x + 8,
          pageY: y - 8,
          force: true,
        })
        .trigger('mousemove', {
          which: 1,
          button: 0,
          pageX: x + 70,
          pageY: y - 90,
          force: true,
        });

      cy.get('.gallery-drag-helper').should('exist');
      cy.get('body').trigger('mouseup', { force: true });
      cy.get('.gallery-drag-helper').should('not.exist');
    });
  });

  it('opens the inline rename from its own button', () => {
    cy.get(RENAME_AT(0)).focus().click();
    cy.get(`${AT(0)} [data-gallery-label-input]`).should('be.focused');
    cy.get(`${AT(0)} [data-gallery-label-input]`).type('{esc}');
  });

  // A single click on a thumbnail inserts the image into the selected block.
  // The buttons sit on top of that and must not trigger it as well.
  it('does not insert the image when an action is clicked', () => {
    cy.get(RENAME_AT(0)).focus().click();
    cy.get(`${AT(0)} [data-gallery-label-input]`).type('{esc}');
    // the gallery stays open; inserting would have closed it
    cy.get(PANEL).should('be.visible');
  });
});

describe('US-10 — reopening the image editor on a stored image', () => {
  before(() => {
    cy.login();
    cy.openEditor();
    cy.openGallery();
  });

  afterEach(() => {
    cy.get('body').then(($body) => {
      if ($body.find(EDITOR).length)
        cy.get(EDITOR_CANCEL).click({ force: true });
    });
    cy.get(EDITOR).should('not.exist');
  });

  it('opens the editor on the image that was clicked', () => {
    cy.get(EDIT_AT(0)).focus().click();
    cy.get(EDITOR, { timeout: 15000 }).should('be.visible');
    cy.get(`${EDITOR} canvas`).should('exist');
  });

  // The stored name is the md5 of the content and the server only ever
  // pushes, so a save here can only add an entry. The button says so, rather
  // than letting the user believe their original is about to be overwritten.
  it('offers to save as a new file, not to overwrite', () => {
    cy.get(EDIT_AT(0)).focus().click();
    cy.get(EDITOR_SAVE, { timeout: 15000 })
      .invoke('text')
      .should('match', /nouveau fichier|new file/i);
  });

  // The save label is three times longer than "Annuler", and the row it sits
  // in shrinks its items. It wrapped onto a second line and stood visibly
  // taller than the button beside it.
  it('keeps the two decision buttons the same height', () => {
    cy.get(EDIT_AT(0)).focus().click();
    cy.get(EDITOR_SAVE, { timeout: 15000 }).then(($save) => {
      cy.get(EDITOR_CANCEL).then(($cancel) => {
        const save = $save[0].getBoundingClientRect();
        const cancel = $cancel[0].getBoundingClientRect();
        expect(save.height).to.be.closeTo(cancel.height, 1);
        // one line each: a wrapped label is what broke the balance
        expect(save.height).to.be.lessThan(48);
      });
    });
  });

  it('leaves the gallery untouched when the editor is cancelled', () => {
    cy.get(COUNT)
      .invoke('text')
      .then((before) => {
        cy.get(EDIT_AT(0)).focus().click();
        cy.get(EDITOR, { timeout: 15000 }).should('be.visible');
        cy.get(EDITOR_CANCEL).click();
        cy.get(EDITOR).should('not.exist');
        cy.get(COUNT).invoke('text').should('eq', before);
      });
  });

  // The one test that writes. It cleans up after itself through the
  // interface: a suite that leaves an image behind on every run grows the
  // gallery of whoever runs it, forever. Removing it here also exercises the
  // delete button and its confirmation, which nothing else does.
  //
  // It waits on the COUNTER rather than on the label. The first version
  // waited for the top label to match /\(\d+\)/ — which a copy left by an
  // earlier run already satisfied, so it asserted nothing and then compared
  // that stale copy against itself.
  it('adds a numbered copy on save, leaving the original in place', () => {
    cy.get(COUNT)
      .invoke('text')
      .then((countBefore) => {
        cy.get(LABEL_AT(0))
          .invoke('text')
          .then((text) => {
            const original = text.trim();
            const base = original.replace(/\s\(\d+\)(?=\.[^.]+$|$)/, '');

            cy.get(EDIT_AT(0)).focus().click();
            cy.get(EDITOR, { timeout: 15000 }).should('be.visible');
            cy.get(EDITOR_SAVE).click();

            // one more image than before: the save added, it did not replace
            cy.get(COUNT, { timeout: 20000 })
              .invoke('text')
              .should('not.eq', countBefore);

            // the copy lands at the top, newest first, under a numbered name
            cy.get(LABEL_AT(0))
              .invoke('text')
              .should((copy) => {
                expect(copy.trim()).not.to.eq(original);
                expect(copy.trim()).to.match(/\(\d+\)/);
              });

            // and the original is still there, under its own name
            cy.get(SEARCH).clear().type(base);
            cy.get(`${PANEL} [data-gallery-label]`)
              .invoke('text')
              .should('contain', base);
            cy.get(SEARCH).clear();

            // put the gallery back as it was found
            cy.get(REMOVE_AT(0)).focus().click();
            cy.get(COUNT, { timeout: 15000 })
              .invoke('text')
              .should('eq', countBefore);
            cy.get(LABEL_AT(0))
              .invoke('text')
              .should((after) => expect(after.trim()).to.eq(original));
          });
      });
  });
});
