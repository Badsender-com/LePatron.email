'use strict';

// Who builds a company's taxonomy (epic #1547, ADR-0026): the tech admin and the
// super admin. The company admin reads it and changes nothing, the email type
// included: a right withdrawn on purpose.

const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');

// Turned on by #1549 (only the tech admin and the super admin change the taxonomy)
describe.skip('taxonomy.manage capability', () => {
  it('is declared under the name the server and the UI ask for', () => {
    expect(CAPABILITIES.TAXONOMY_MANAGE).toBe('taxonomy.manage');
  });

  it.each([
    [ROLES.SUPER_ADMIN, true],
    [ROLES.GROUP_ADMIN_TECH, true],
    [ROLES.GROUP_ADMIN, false],
    [ROLES.REGULAR_USER, false],
    [ROLES.WRITER, false],
    [ROLES.REVIEWER, false],
  ])('%s holds it: %s', (role, expected) => {
    expect(roleCan(role, 'taxonomy.manage')).toBe(expected);
  });

  // The company admin keeps the rest of the company's settings: only the
  // taxonomy moves out of its hands.
  it('leaves the company admin its company settings', () => {
    expect(roleCan(ROLES.GROUP_ADMIN, CAPABILITIES.GROUP_MANAGE)).toBe(true);
  });
});
