import { superAdminErrorMessage } from '~/helpers/super-admin-errors.js';

// A guardrail refusal reads as its own sentence; anything else reads as the
// generic error, so a renamed code never surfaces as a raw identifier.
const vm = {
  $t: (key) =>
    ({
      'superAdmins.errors.LAST_SUPER_ADMIN_PROTECTED':
        'At least one active super admin must remain.',
      'global.errors.errorOccured': 'An error occurred',
    }[key] || key),
};

const axiosError = (message) => ({ response: { data: { message } } });

describe('superAdminErrorMessage', () => {
  it('translates a guardrail refusal', () => {
    expect(
      superAdminErrorMessage(vm, axiosError('LAST_SUPER_ADMIN_PROTECTED'))
    ).toBe('At least one active super admin must remain.');
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
