<script>
import { mapGetters, mapMutations } from 'vuex';
import { Plug, Unplug } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { CAN, MODULES_GROUP, USER } from '~/store/user.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import { canConnectApplications } from '~/helpers/module-activation.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { CAPABILITIES } from '../../../shared/access/roles.js';

// The value of the company filter that shows every company.
const ALL_GROUPS = 'all';

const idOf = (group) => group && String(group.id || group._id);

// The AI assistants the user connected to LePatron (ADR 0012), each bound to
// a group, which they revoke one by one. One row per connection: an
// assistant connected from two machines has two, told apart by their date.
// Whoever manages the platform connects in any company: the page starts on
// the selected one. A company shown without the MCP module or MCP access
// (ADR 0017) is said to let no assistant in.
export default {
  name: 'PageConnectedApplications',
  components: {
    BsPageHeader,
    BsModalConfirm,
    BsSelect,
    LucidePlug: Plug,
    LucideUnplug: Unplug,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_USER,
  },
  async asyncData({ $axios }) {
    try {
      const { items } = await $axios.$get(apiRoutes.connectedApplications());
      return { applications: items, loadError: false };
    } catch (error) {
      console.error(error);
      return { applications: [], loadError: true };
    }
  },
  data() {
    return {
      applications: [],
      loadError: false,
      toRevoke: null,
      groupFilter: ALL_GROUPS,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    ...mapGetters(USER, { can: CAN, modulesGroup: MODULES_GROUP }),
    canManagePlatform() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE);
    },
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
    title() {
      return this.$t('connectedApplications.pageTitle');
    },
    // The date of the connection about to be revoked, which tells it from
    // the other connections of the same application.
    toRevokeConnectedAt() {
      return this.connectedOn(this.toRevoke);
    },
    headers() {
      return [
        { text: this.$t('connectedApplications.name'), value: 'name' },
        { text: this.$t('connectedApplications.group'), value: 'group' },
        {
          text: this.$t('connectedApplications.connectedAt'),
          value: 'connectedAt',
        },
        {
          text: this.$t('connectedApplications.lastUsedAt'),
          value: 'lastUsedAt',
        },
        { text: '', value: 'actions', sortable: false, align: 'end' },
      ];
    },
  },
  created() {
    // Whoever manages the platform starts on the selected company.
    if (this.canManagePlatform && this.modulesGroup) {
      this.groupFilter = idOf(this.modulesGroup);
    }
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    connectedOn(application) {
      if (!application) return '';
      return this.$options.filters.preciseDateTime(
        application.connectedAt,
        this.$i18n.locale
      );
    },
    askRevoke(application) {
      this.toRevoke = application;
      this.$refs.revokeModal.open();
    },
    async revoke() {
      const application = this.toRevoke;
      try {
        await this.$axios.$delete(
          apiRoutes.connectedApplicationsItem({ id: application.id })
        );
        this.applications = this.applications.filter(
          (candidate) => candidate.id !== application.id
        );
        this.showSnackbar({
          text: this.$t('connectedApplications.revoked'),
          color: 'success',
        });
      } catch (error) {
        // Revoked already, from another tab or by the company's admin.
        const gone =
          error?.response?.data?.message ===
          ERROR_CODES.MCP_CONNECTION_NOT_FOUND;
        if (gone) {
          this.applications = this.applications.filter(
            (candidate) => candidate.id !== application.id
          );
        }
        this.showSnackbar({
          text: gone
            ? this.$t(
                `connectedApplications.errors.${ERROR_CODES.MCP_CONNECTION_NOT_FOUND}`
              )
            : this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.error(error);
      } finally {
        this.toRevoke = null;
      }
    },
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ title }}
      </template>
    </bs-page-header>
    <v-container fluid>
      <p class="text-body-2 text--secondary">
        {{ $t('connectedApplications.description') }}
      </p>
      <bs-select
        v-if="canManagePlatform"
        v-model="groupFilter"
        class="bs-connected-applications__filter"
        :label="$t('connectedApplications.group')"
        :items="groupItems"
        dense
      />
      <v-alert v-if="shownGroupNotice" type="info" outlined text>
        {{ shownGroupNotice }}
      </v-alert>
      <v-alert v-if="loadError" type="error" outlined text>
        {{ $t('connectedApplications.loadError') }}
      </v-alert>
      <v-data-table
        v-else
        :headers="headers"
        :items="shownApplications"
        item-key="id"
        hide-default-footer
        disable-pagination
      >
        <template #no-data>
          <div class="py-6 text--secondary">
            <lucide-plug :size="24" class="mb-2" />
            <p class="mb-0">{{ $t('connectedApplications.empty') }}</p>
          </div>
        </template>
        <template #item.name="{ item }">
          <span class="font-weight-medium">{{ item.name }}</span>
        </template>
        <template #item.group="{ item }">
          {{ item.group.name }}
        </template>
        <template #item.connectedAt="{ item }">
          <span class="text--secondary">
            {{ item.connectedAt | preciseDateTime($i18n.locale) }}
          </span>
        </template>
        <template #item.lastUsedAt="{ item }">
          <span v-if="item.lastUsedAt" class="text--secondary">
            {{ item.lastUsedAt | preciseDateTime($i18n.locale) }}
          </span>
          <span v-else class="text--secondary">
            {{ $t('connectedApplications.neverUsed') }}
          </span>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            text
            small
            color="error"
            :aria-label="
              $t('connectedApplications.revokeOne', {
                name: item.name,
                date: connectedOn(item),
              })
            "
            @click="askRevoke(item)"
          >
            <lucide-unplug :size="16" class="mr-1" />
            {{ $t('connectedApplications.revoke') }}
          </v-btn>
        </template>
      </v-data-table>
      <bs-modal-confirm
        ref="revokeModal"
        :title="$t('connectedApplications.revokeTitle')"
        :action-label="$t('connectedApplications.revoke')"
        @confirm="revoke"
      >
        <p v-if="toRevoke">
          {{
            $t('connectedApplications.revokeConfirm', {
              name: toRevoke.name,
              group: toRevoke.group.name,
              date: toRevokeConnectedAt,
            })
          }}
        </p>
      </bs-modal-confirm>
    </v-container>
  </div>
</template>

<style lang="scss" scoped>
.bs-connected-applications__filter {
  max-width: 320px;
}
</style>
