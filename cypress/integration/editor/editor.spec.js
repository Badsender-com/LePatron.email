/// <reference types="cypress" />

describe('Editor', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/account/login');
  });

  it('should login as admin correctly', () => {
    cy.get('input[name=username]').type('admin');
    cy.get('button[type=submit]').click();

    cy.get('input[name=password]').type('admin');
    cy.get('button[type=submit').click();

    cy.url().should((url) => {
      expect(url).toBe('http://localhost:3000/groups');
    });
  });
});
