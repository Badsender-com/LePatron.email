'use strict';

// Composing is a capability of its own (ADR 0027). It used to ride on editing
// an email's structure, which tied two unrelated gestures together: the
// capability separates them without changing anybody's rights today — it is
// held by exactly the roles that hold `mailing.edit-structure`.

const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');

const EVERY_ROLE = Object.values(ROLES);

describe('composing is a capability of its own', () => {
  it('is a capability of the role table', () => {
    expect(CAPABILITIES.BLOCK_COMPOSE).toBe('block.compose');
  });

  it.each(EVERY_ROLE)(
    'is held by %s exactly when it may edit an email structure',
    (role) => {
      expect(roleCan(role, CAPABILITIES.BLOCK_COMPOSE)).toBe(
        roleCan(role, CAPABILITIES.MAILING_EDIT_STRUCTURE)
      );
    }
  );

  it('is refused to the writer and the reviewer', () => {
    expect(roleCan(ROLES.WRITER, CAPABILITIES.BLOCK_COMPOSE)).toBe(false);
    expect(roleCan(ROLES.REVIEWER, CAPABILITIES.BLOCK_COMPOSE)).toBe(false);
  });
});
