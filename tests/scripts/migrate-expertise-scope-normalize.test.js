'use strict';

const {
  planScopeMigration,
} = require('../../scripts/migrate-expertise-scope-normalize');

describe('migrate-expertise-scope-normalize.planScopeMigration', () => {
  it('normalises a scope written before the rule existed', () => {
    expect(planScopeMigration({ scope: ['CTA', ' Objet'] })).toEqual({
      scope: ['cta', 'objet'],
      collapsed: false,
    });
  });

  // Idempotence: re-running must write nothing.
  it('leaves an already canonical scope alone', () => {
    expect(planScopeMigration({ scope: ['cta', 'objet'] })).toBeNull();
  });

  it('treats a differently ordered scope as needing a rewrite', () => {
    expect(planScopeMigration({ scope: ['objet', 'cta'] })).toEqual({
      scope: ['cta', 'objet'],
      collapsed: false,
    });
  });

  it('flags a collapse so it is reported rather than silent', () => {
    expect(planScopeMigration({ scope: ['CTA', 'cta'] })).toEqual({
      scope: ['cta'],
      collapsed: true,
    });
  });

  it('handles a missing or empty scope', () => {
    expect(planScopeMigration({})).toBeNull();
    expect(planScopeMigration({ scope: [] })).toBeNull();
  });

  it('drops a scope made only of blanks', () => {
    expect(planScopeMigration({ scope: ['  '] })).toEqual({
      scope: [],
      collapsed: true,
    });
  });
});
