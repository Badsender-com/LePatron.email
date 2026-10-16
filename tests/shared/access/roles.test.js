'use strict';

// The rights matrix, written out: changing what a role may do changes this
// table, in the same review. Read a row as "these roles, and only these, have
// the capability".

const {
  ROLES,
  CAPABILITIES,
  ALL_CAPABILITIES,
  assertCapability,
  capabilitiesOfRole,
  roleCan,
  isRoleWithin,
} = require('../../../packages/shared/access/roles.js');

const {
  SUPER_ADMIN,
  GROUP_ADMIN_TECH,
  GROUP_ADMIN,
  REGULAR_USER,
  WRITER,
  REVIEWER,
} = ROLES;

const EVERY_ROLE = [
  SUPER_ADMIN,
  GROUP_ADMIN_TECH,
  GROUP_ADMIN,
  REGULAR_USER,
  WRITER,
  REVIEWER,
];
const AUTHORS = [SUPER_ADMIN, GROUP_ADMIN_TECH, GROUP_ADMIN, REGULAR_USER];

const MATRIX = {
  [CAPABILITIES.PLATFORM_MANAGE]: [SUPER_ADMIN],
  [CAPABILITIES.GROUP_MANAGE]: [SUPER_ADMIN, GROUP_ADMIN_TECH, GROUP_ADMIN],
  [CAPABILITIES.GROUP_MANAGE_TECH]: [SUPER_ADMIN, GROUP_ADMIN_TECH],
  [CAPABILITIES.MAILING_CREATE]: AUTHORS,
  [CAPABILITIES.MAILING_ORGANIZE]: [...AUTHORS, WRITER],
  [CAPABILITIES.MAILING_DELETE]: AUTHORS,
  [CAPABILITIES.MAILING_EDIT_CONTENT]: [...AUTHORS, WRITER],
  [CAPABILITIES.MAILING_EDIT_STRUCTURE]: AUTHORS,
  [CAPABILITIES.MAILING_EDIT_STYLE]: AUTHORS,
  [CAPABILITIES.MAILING_COMMENT]: EVERY_ROLE,
  [CAPABILITIES.MAILING_SEND_TEST]: EVERY_ROLE,
  [CAPABILITIES.MAILING_EXPORT]: EVERY_ROLE,
  [CAPABILITIES.FOLDER_MANAGE]: [...AUTHORS, WRITER],
  [CAPABILITIES.FOLDER_DELETE]: AUTHORS,
  [CAPABILITIES.GALLERY_MANAGE]: EVERY_ROLE,
  [CAPABILITIES.BLOCK_LIBRARY_ADD]: AUTHORS,
};

describe('the rights matrix', () => {
  it('has a row for every capability, and no other', () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...ALL_CAPABILITIES].sort());
  });

  it('covers every role of the product', () => {
    expect([...EVERY_ROLE].sort()).toEqual(Object.values(ROLES).sort());
  });

  describe.each(Object.entries(MATRIX))('%s', (capability, granted) => {
    it.each(EVERY_ROLE)('for %s', (role) => {
      expect(roleCan(role, capability)).toBe(granted.includes(role));
    });
  });
});

describe('a right that is not granted is refused', () => {
  it('gives an unknown role nothing', () => {
    expect(capabilitiesOfRole('owner')).toEqual([]);
    expect(capabilitiesOfRole(undefined)).toEqual([]);
    expect(roleCan('owner', CAPABILITIES.MAILING_COMMENT)).toBe(false);
  });

  it('reads nothing from the prototype', () => {
    expect(capabilitiesOfRole('constructor')).toEqual([]);
    expect(capabilitiesOfRole('__proto__')).toEqual([]);
  });

  it('throws on a misspelt capability instead of refusing everyone', () => {
    expect(() => roleCan(REGULAR_USER, 'mailing.edit-structre')).toThrow(
      'Unknown capability: mailing.edit-structre'
    );
    expect(() => assertCapability(undefined)).toThrow();
  });

  it('cannot be widened at runtime', () => {
    expect(Object.isFrozen(capabilitiesOfRole(REVIEWER))).toBe(true);
    expect(Object.isFrozen(ROLES)).toBe(true);
    expect(Object.isFrozen(CAPABILITIES)).toBe(true);
  });
});

describe('isRoleWithin: nobody hands out more than they hold', () => {
  const own = (role) => capabilitiesOfRole(role);

  it.each([
    [GROUP_ADMIN, GROUP_ADMIN, true],
    [GROUP_ADMIN, REGULAR_USER, true],
    [GROUP_ADMIN, WRITER, true],
    [GROUP_ADMIN, REVIEWER, true],
    [GROUP_ADMIN, GROUP_ADMIN_TECH, false],
    [GROUP_ADMIN, SUPER_ADMIN, false],
    [GROUP_ADMIN_TECH, GROUP_ADMIN_TECH, true],
    [GROUP_ADMIN_TECH, GROUP_ADMIN, true],
    [GROUP_ADMIN_TECH, SUPER_ADMIN, false],
    [SUPER_ADMIN, SUPER_ADMIN, true],
  ])('a %s and a %s: %s', (actor, role, expected) => {
    expect(isRoleWithin(role, own(actor))).toBe(expected);
  });

  it('refuses an unknown role, though it holds nothing', () => {
    expect(isRoleWithin('owner', ALL_CAPABILITIES)).toBe(false);
  });
});
