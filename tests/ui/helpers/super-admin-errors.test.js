import { superAdminErrorMessage } from '~/helpers/super-admin-errors.js';

// A guardrail refusal reads as its own sentence; anything else reads as the
// generic error, so a renamed code never surfaces as a raw identifier.
const MESSAGES = {
  'superAdmins.errors.FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION':
    'You cannot take the role away from yourself.',
  'global.errors.errorOccured': 'An error occurred',
};
const vm = {
  $t: (key) => MESSAGES[key] || key,
  $te: (key) => key in MESSAGES,
};

const axiosError = (message) => ({ response: { data: { message } } });

describe('superAdminErrorMessage', () => {
  it('translates a guardrail refusal', () => {
    expect(
      superAdminErrorMessage(
        vm,
        axiosError('FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION')
      )
    ).toBe('You cannot take the role away from yourself.');
  });

  it('falls back to the generic error for a code outside the guardrails', () => {
    expect(superAdminErrorMessage(vm, axiosError('USER_NOT_FOUND'))).toBe(
      'An error occurred'
    );
  });

  it('falls back to the generic error without a response', () => {
    expect(superAdminErrorMessage(vm, new Error('network'))).toBe(
      'An error occurred'
    );
  });
});
