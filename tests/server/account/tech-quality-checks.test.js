'use strict';

// The required tracking parameters are set with the company's tracking, a
// tech admin's (ADR 0004, ADR 0009): so is the state of their quality check,
// on a group and on a template. Decided for every role.

const {
  assertTechChecksAllowed,
} = require('../../../packages/server/account/tech-quality-checks.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');

const refusal = (run) => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a refusal');
};

describe('assertTechChecksAllowed', () => {
  const off = { checks: { 'tracking-params': { state: 'off' } } };
  const on = { checks: { 'tracking-params': { state: 'on' } } };
  const userOf = (role) => ({ role, group: { id: 'g1' } });

  it.each(Object.values(ROLES))(
    'decides a change of the tracking check for a %s',
    (role) => {
      const run = () => assertTechChecksAllowed(userOf(role), off, on);
      if (roleCan(role, CAPABILITIES.GROUP_MANAGE_TECH)) {
        expect(run).not.toThrow();
      } else {
        const error = refusal(run);
        expect(error.status).toBe(403);
        expect(error.message).toBe('FORBIDDEN_TECH_QUALITY_CHECK');
      }
    }
  );

  it.each(Object.values(ROLES))(
    'lets a %s send the tracking check back as it is',
    (role) => {
      expect(() =>
        assertTechChecksAllowed(userOf(role), off, {
          checks: { ...off.checks, headings: { state: 'off' } },
        })
      ).not.toThrow();
    }
  );
});
