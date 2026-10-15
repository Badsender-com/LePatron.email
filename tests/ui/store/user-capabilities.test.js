import { getters, CAN, USER_CAPABILITIES } from '~/store/user.js';
import { capabilitiesOfRole } from '../../../packages/shared/access/roles.js';

// The UI asks for a capability, as the server sent it with the user; it
// compares no role.
function storeOf(info) {
  const state = { info };
  const resolved = {};
  resolved[USER_CAPABILITIES] = getters[USER_CAPABILITIES](state);
  return { can: getters[CAN](state, resolved) };
}

describe('CAN', () => {
  it("answers from the user's capabilities", () => {
    const { can } = storeOf({ capabilities: capabilitiesOfRole('writer') });

    expect(can('mailing.edit-content')).toBe(true);
    expect(can('mailing.delete')).toBe(false);
  });

  it('refuses everything without a user, or without capabilities', () => {
    expect(storeOf(null).can('mailing.comment')).toBe(false);
    expect(storeOf({ role: 'regular_user' }).can('mailing.comment')).toBe(
      false
    );
  });

  it('throws on a misspelt capability instead of hiding for everyone', () => {
    expect(() => storeOf(null).can('mailing.remove')).toThrow();
  });
});
