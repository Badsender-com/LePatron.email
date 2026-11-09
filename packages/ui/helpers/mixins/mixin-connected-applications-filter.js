import { canConnectApplications } from '~/helpers/module-activation.js';

// The value of the company filter that shows every company.
const ALL_GROUPS = 'all';

const idOf = (group) => group && String(group.id || group._id);

/**
 * The company filter of the connected applications page (ADR 0017). Whoever
 * manages the platform connects in any company: the page starts on the
 * selected one, offers the others and all of them. A company shown without
 * the MCP module or MCP access is said to let no assistant in.
 *
 * The host gives `applications` (one per connection, its `group` with the
 * two flags), `canManagePlatform`, and `modulesGroup` (the selected company
 * of a super admin, anyone else's own).
 */
export default {
  data() {
    return { groupFilter: ALL_GROUPS };
  },
  computed: {
    // The selected company first, whether it has connections or not, then
    // the companies of the connections, by name.
    groupItems() {
      const names = new Map();
      if (this.modulesGroup) {
        names.set(idOf(this.modulesGroup), this.modulesGroup.name);
      }
      [...this.applications]
        .sort((a, b) => a.group.name.localeCompare(b.group.name))
        .forEach(({ group }) => {
          if (!names.has(group.id)) names.set(group.id, group.name);
        });
      return [
        { value: ALL_GROUPS, text: this.$t('connectedApplications.allGroups') },
        ...[...names].map(([value, text]) => ({ value, text })),
      ];
    },
    shownApplications() {
      if (this.groupFilter === ALL_GROUPS) return this.applications;
      return this.applications.filter(
        ({ group }) => group.id === this.groupFilter
      );
    },
    // The company the page shows: the one filtered on, or anyone else's own,
    // where all their connections are. None for all the companies.
    shownGroupId() {
      if (this.groupFilter !== ALL_GROUPS) return this.groupFilter;
      return this.canManagePlatform ? null : idOf(this.modulesGroup);
    },
    shownGroup() {
      const id = this.shownGroupId;
      if (!id) return null;
      // As listed with the connections, or, without any, as the store has it.
      const listed = this.applications.find(({ group }) => group.id === id);
      if (listed) return listed.group;
      return idOf(this.modulesGroup) === id ? this.modulesGroup : null;
    },
    shownGroupNotice() {
      const group = this.shownGroup;
      // A company whose flags did not load says nothing rather than a guess.
      const known = group && typeof group.enableMcpModule === 'boolean';
      if (!known || canConnectApplications(group)) return '';
      const key =
        group.enableMcpModule === true
          ? 'connectedApplications.accessOff'
          : 'connectedApplications.noModule';
      return this.$t(key, { group: group.name });
    },
  },
  watch: {
    // The last connection of the company filtered on revoked, the company
    // leaves the filter: every connection is shown rather than none. The
    // selected company stays, with what the page says of it.
    groupItems(items) {
      if (!items.some(({ value }) => value === this.groupFilter)) {
        this.groupFilter = ALL_GROUPS;
      }
    },
  },
  created() {
    // Whoever manages the platform starts on the selected company.
    if (this.canManagePlatform && this.modulesGroup) {
      this.groupFilter = idOf(this.modulesGroup);
    }
  },
};
