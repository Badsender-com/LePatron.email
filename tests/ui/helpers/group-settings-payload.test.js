import mixinGroupSettingsSave, {
  groupSettingsPayload,
} from '~/helpers/mixins/mixin-group-settings-save.js';
import {
  ROLES,
  CAPABILITIES,
  roleCan,
} from '../../../packages/shared/access/roles.js';

// A save of the company settings sends the fields changed on the page since it
// was loaded, and only those: a page left open in a tab never undoes a change
// made elsewhere since, a module opened above all.
const loaded = () => ({
  id: 'g1',
  name: 'Acme',
  status: 'active',
  colorScheme: { primary: '#000', secondary: '#fff' },
  emailMetadata: { enabled: true, fields: { campaign: true } },
  enableEmailBuilder: true,
  enableCrmIntelligence: false,
  enableMcpModule: false,
  isPlatform: false,
});

const managesPlatform = (role) => roleCan(role, CAPABILITIES.PLATFORM_MANAGE);

describe.each(Object.values(ROLES))(
  'a save of the settings, for a %s',
  (role) => {
    const canManagePlatform = managesPlatform(role);

    it('never sends a field left untouched, a module least of all', () => {
      const group = { ...loaded(), name: 'Acme Corp', status: 'demo' };

      const sent = groupSettingsPayload(group, loaded(), { canManagePlatform });

      // A company admin sends its company's name and colours at most.
      expect(sent).toEqual(
        canManagePlatform
          ? { name: 'Acme Corp', status: 'demo' }
          : { name: 'Acme Corp' }
      );
      expect(sent).not.toHaveProperty('enableMcpModule');
      expect(sent).not.toHaveProperty('enableEmailBuilder');
      expect(sent).not.toHaveProperty('enableCrmIntelligence');
    });

    it('sends an object changed deep inside, whole', () => {
      const group = loaded();
      group.colorScheme.secondary = '#eee';

      expect(
        groupSettingsPayload(group, loaded(), { canManagePlatform })
      ).toEqual({ colorScheme: { primary: '#000', secondary: '#eee' } });
    });

    it('sends nothing when nothing changed', () => {
      expect(
        groupSettingsPayload(loaded(), loaded(), { canManagePlatform })
      ).toEqual({});
    });

    it('never sends the switches of the company, saved on their own', () => {
      const group = {
        ...loaded(),
        requireTwoFactor: true,
        enableMcp: true,
        allowRetex: true,
      };

      expect(
        groupSettingsPayload(group, loaded(), { canManagePlatform })
      ).toEqual({});
    });

    it('sends only the fields the page edits', () => {
      const group = {
        ...loaded(),
        name: 'Acme Corp',
        colorScheme: { primary: '#111' },
      };

      expect(
        groupSettingsPayload(group, loaded(), {
          canManagePlatform,
          fields: ['colorScheme'],
        })
      ).toEqual({ colorScheme: { primary: '#111' } });
    });
  }
);

describe('a save of the settings, by whoever manages the platform', () => {
  it('sends a module it switched, and a setting changed deep inside', () => {
    const group = { ...loaded(), enableMcpModule: true };
    group.emailMetadata.fields.campaign = false;

    expect(
      groupSettingsPayload(group, loaded(), { canManagePlatform: true })
    ).toEqual({
      enableMcpModule: true,
      emailMetadata: { enabled: true, fields: { campaign: false } },
    });
  });
});

// The page itself: the mixin, exercised against a fake instance (the
// repository has no @vue/test-utils).
function settingsPage(group, put, { fields } = {}) {
  const vm = {
    ...mixinGroupSettingsSave.data(),
    group,
    canManagePlatform: true,
    snackbars: [],
    $route: { params: { groupId: 'g1' } },
    $axios: { $put: put },
    $options: { groupSettingsFields: fields },
    $t: (key) => key,
    $te: () => false,
  };
  Object.entries(mixinGroupSettingsSave.methods).forEach(([name, fn]) => {
    vm[name] = fn.bind(vm);
  });
  vm.showSnackbar = (snackbar) => vm.snackbars.push(snackbar);
  mixinGroupSettingsSave.created.call(vm);
  return vm;
}

describe('the save of a settings page', () => {
  it('sends no request when nothing changed', async () => {
    const put = jest.fn();
    const vm = settingsPage(loaded(), put);

    await vm.updateGroup();

    expect(put).not.toHaveBeenCalled();
    expect(vm.snackbars).toEqual([
      { text: 'snackbars.updated', color: 'success' },
    ]);
  });

  it('measures the next save from the company as saved', async () => {
    const saved = { ...loaded(), name: 'Acme Corp' };
    const put = jest.fn().mockResolvedValue(saved);
    const vm = settingsPage(loaded(), put);

    vm.group.name = 'Acme Corp';
    await vm.updateGroup();
    expect(put).toHaveBeenLastCalledWith('/groups/g1', { name: 'Acme Corp' });
    expect(vm.group).toBe(saved);

    vm.group.status = 'demo';
    await vm.updateGroup();
    expect(put).toHaveBeenLastCalledWith('/groups/g1', { status: 'demo' });
  });

  it('keeps measuring from the company as loaded after a failed save', async () => {
    const put = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({});
    const vm = settingsPage(loaded(), put);

    vm.group.name = 'Acme Corp';
    await vm.updateGroup();
    await vm.updateGroup();

    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenLastCalledWith('/groups/g1', { name: 'Acme Corp' });
  });

  // The page of the colours names the colours: whatever else its group holds
  // stays out of its save.
  it('of the colours sends the colours alone', async () => {
    const put = jest.fn().mockResolvedValue({});
    const vm = settingsPage(loaded(), put, { fields: ['colorScheme'] });

    vm.group = {
      ...vm.group,
      enableMcpModule: true,
      colorScheme: { primary: '#111' },
    };
    await vm.updateGroup();

    expect(put).toHaveBeenCalledWith('/groups/g1', {
      colorScheme: { primary: '#111' },
    });
  });
});
