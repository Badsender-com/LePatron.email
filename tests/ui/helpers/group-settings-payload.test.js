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
