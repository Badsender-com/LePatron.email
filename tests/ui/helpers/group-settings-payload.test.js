import { groupSettingsPayload } from '~/helpers/mixins/mixin-group-settings-save.js';
import {
  ROLES,
  CAPABILITIES,
  roleCan,
} from '../../../packages/shared/access/roles.js';

// A save of the company settings sends what the server lets the actor change:
// a company admin its company's name and colours, whoever manages the
// platform the whole company.
const group = {
  name: 'Acme',
  colorScheme: { primary: '#000' },
  downloadMailingWithFtpImages: true,
  isPlatform: false,
};

describe('groupSettingsPayload', () => {
  it.each(Object.values(ROLES))('for a %s', (role) => {
    const managesPlatform = roleCan(role, CAPABILITIES.PLATFORM_MANAGE);
    const expected = managesPlatform
      ? group
      : { name: 'Acme', colorScheme: { primary: '#000' } };

    expect(groupSettingsPayload(group, managesPlatform)).toEqual(expected);
  });
});

// The company's switches are each saved on their own (mixin-group-switch.js):
// a settings page read before one was switched never switches it back.
it.each(Object.values(ROLES))(
  'never sends the switches of the company, for a %s',
  (role) => {
    const managesPlatform = roleCan(role, CAPABILITIES.PLATFORM_MANAGE);
    const sent = groupSettingsPayload(
      { ...group, requireTwoFactor: true, enableMcp: true, allowRetex: true },
      managesPlatform
    );

    expect(sent).not.toHaveProperty('requireTwoFactor');
    expect(sent).not.toHaveProperty('enableMcp');
    expect(sent).not.toHaveProperty('allowRetex');
    expect(sent.name).toBe('Acme');
  }
);
