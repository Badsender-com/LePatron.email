<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupLoading from '~/components/loadingBar';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsCompaniesNav from '~/components/group/companies-nav.vue';
import BsModalCreateGroup from '~/components/group/modal-create-group.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { IS_ADMIN, USER } from '~/store/user';
import { Building2, Pencil, Check } from 'lucide-vue';
import BsRowActions from '~/components/row-actions/BsRowActions.vue';

export default {
  name: 'PageGroups',
  components: {
    BsGroupLoading,
    BsGroupSettingsPageHeader,
    BsCompaniesNav,
    BsModalCreateGroup,
    BsDataTable,
    BsRowActions,
    // Used via $options.components.LucideBuilding2 in template
    // eslint-disable-next-line vue/no-unused-components
    LucideBuilding2: Building2,
    LucideCheck: Check,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios } = nuxtContext;
    try {
      const groupsResponse = await $axios.$get(apiRoutes.groups());
      return { groups: groupsResponse.items };
    } catch (error) {
      console.error('[Groups] Failed to load groups:', error);
      return { groups: [] };
    }
  },
  data() {
    return {
      groups: [],
      modalLoading: false,
      loading: false,
    };
  },
  head() {
    return { title: this.pageTitle };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
    }),
    pageTitle() {
      return this.$t('settingsNav.companiesList');
    },
    title() {
      return this.$t('settingsNav.companiesList');
    },
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        {
          text: this.$t('global.createdAt'),
          align: 'left',
          value: 'createdAt',
        },
        {
          text: this.$t('tableHeaders.groups.status'),
          align: 'center',
          value: 'status',
        },
        {
          text: this.$t('tableHeaders.groups.downloadWithoutEnclosingFolder'),
          align: 'center',
          value: 'downloadMailingWithoutEnclosingFolder',
        },
        {
          text: this.$t('tableHeaders.groups.cdnDownload'),
          align: 'center',
          value: 'downloadMailingWithCdnImages',
        },
        {
          text: this.$t('tableHeaders.groups.ftpDownload'),
          align: 'center',
          value: 'downloadMailingWithFtpImages',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          align: 'center',
          sortable: false,
        },
      ];
    },
  },
  watch: {
    pageTitle: {
      immediate: true,
      handler(newTitle) {
        if (newTitle) {
          this.mixinPageTitleUpdateTitle(newTitle);
        }
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    openCreateModal() {
      this.$refs.createGroupModal.open();
    },
    goToGroup(group) {
      this.$router.push(`/groups/${group.id}/settings/general`);
    },
    /**
     * Build quick actions for a group row
     * Design System: Only Edit action
     */
    buildQuickActions(item) {
      return [
        {
          key: 'edit',
          icon: Pencil,
          text: 'global.edit',
          onClick: () => this.goToGroup(item),
        },
      ];
    },
    async createGroup(group) {
      try {
        this.modalLoading = true;
        const createdGroup = await this.$axios.$post(apiRoutes.groups(), group);
        this.$refs.createGroupModal.close();
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        // Navigate to the new group's settings
        this.$router.push(`/groups/${createdGroup.id}/settings/general`);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.modalLoading = false;
      }
    },
    getStatusColor(status) {
      const colors = {
        active: 'success',
        demo: 'info',
        inactive: 'grey',
      };
      return colors[status] || 'grey';
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-companies-nav />
    </template>
    <client-only>
      <div class="settings-content">
        <bs-group-settings-page-header :title="$t('settingsNav.companiesList')">
          <template #actions>
            <v-btn color="accent" elevation="0" @click="openCreateModal">
              <v-icon left>
                mdi-plus
              </v-icon>
              {{ $t('global.add') }}
            </v-btn>
          </template>
        </bs-group-settings-page-header>

        <v-card elevation="0" class="pa-4">
          <bs-data-table
            :headers="tableHeaders"
            :items="groups"
            :loading="loading"
            :empty-icon="$options.components.LucideBuilding2"
            :empty-message="$t('settingsNav.companiesEmpty')"
            clickable
            @click:row="goToGroup"
          >
            <template #item.name="{ item }">
              <span class="font-weight-medium">{{ item.name }}</span>
            </template>

            <template #item.createdAt="{ item }">
              <span>{{ item.createdAt | preciseDateTime }}</span>
            </template>

            <template #item.status="{ item }">
              <v-chip
                small
                :color="getStatusColor(item.status)"
                :outlined="item.status !== 'active'"
                :dark="item.status === 'active'"
              >
                {{ item.status }}
              </v-chip>
            </template>

            <template #item.downloadMailingWithoutEnclosingFolder="{ item }">
              <lucide-check
                v-if="item.downloadMailingWithoutEnclosingFolder"
                :size="18"
                class="accent--text"
              />
            </template>

            <template #item.downloadMailingWithCdnImages="{ item }">
              <lucide-check
                v-if="item.downloadMailingWithCdnImages"
                :size="18"
                class="accent--text"
              />
            </template>

            <template #item.downloadMailingWithFtpImages="{ item }">
              <lucide-check
                v-if="item.downloadMailingWithFtpImages"
                :size="18"
                class="accent--text"
              />
            </template>

            <template #item.actions="{ item }">
              <bs-row-actions :quick-actions="buildQuickActions(item)" />
            </template>
          </bs-data-table>
        </v-card>
      </div>
      <bs-group-loading slot="placeholder" />
    </client-only>

    <bs-modal-create-group
      ref="createGroupModal"
      :loading="modalLoading"
      @submit="createGroup"
    />
  </bs-layout-left-menu>
</template>

<style lang="scss" scoped>
.settings-content {
  padding: 0;
}

/* =========================================================================
   BsDataTable Styles — LePatron Design System v1.0
   Based on: /tmp/lepatron-design-latest/preview/components-data-table.html
   ========================================================================= */

/* Headers */
::v-deep .v-data-table thead th {
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: rgba(0, 0, 0, 0.6) !important; // --gray-600
  padding: 10px 16px !important;
  background: rgba(0, 0, 0, 0.02) !important; // --gray-50
  height: 40px !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important; // --gray-300
  white-space: nowrap;
  user-select: none;
}

/* Rows */
::v-deep .v-data-table tbody tr {
  height: 40px !important;
  cursor: pointer;
  transition: background 0.15s ease-out;
}

::v-deep .v-data-table tbody td {
  padding: 10px 16px !important;
  font-size: 13px !important;
  color: rgba(0, 0, 0, 0.87) !important; // --gray-900
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important; // --gray-200
  height: 40px !important;
  vertical-align: middle;
}

::v-deep .v-data-table tbody tr:last-child td {
  border-bottom: none !important;
}

/* Row states */
::v-deep .v-data-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02) !important; // --gray-50
}

::v-deep .v-data-table tbody tr.v-data-table__selected {
  background: rgba(0, 172, 220, 0.06) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected:hover {
  background: rgba(0, 172, 220, 0.1) !important;
}

/* Empty state */
::v-deep .v-data-table__empty-wrapper {
  padding: 48px 24px !important;
  text-align: center;
  color: rgba(0, 0, 0, 0.87) !important; // --gray-900
  font-size: 14px !important;
  font-weight: 600 !important;
}

/* ========================================================================= */
/* Groups table specific styles */
/* ========================================================================= */

/* Name column (primary identifier) */
::v-deep .v-data-table tbody td:nth-child(1) {
  font-weight: 500 !important;
  color: var(--v-primary-base) !important;
}

/* CreatedAt column (date) */
::v-deep .v-data-table tbody td:nth-child(2) {
  color: rgba(0, 0, 0, 0.7) !important; // --gray-700
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Status column (chip) */
::v-deep .v-data-table tbody td:nth-child(3) {
  text-align: center;
}

/* Status chip styling */
::v-deep .v-chip {
  font-size: 11px !important;
  height: 20px !important;
  padding: 0 8px !important;
  font-weight: 500 !important;
}

/* Boolean columns (checkmarks) - columns 4, 5, 6 */
::v-deep .v-data-table tbody td:nth-child(4),
::v-deep .v-data-table tbody td:nth-child(5),
::v-deep .v-data-table tbody td:nth-child(6) {
  text-align: center;
  color: rgba(0, 0, 0, 0.54) !important;
}

/* Actions column */
::v-deep .v-data-table tbody td:last-child {
  text-align: right !important;
  width: 1%;
  white-space: nowrap;
}

::v-deep .v-data-table thead th:last-child {
  text-align: right !important;
  width: 1%;
}
</style>
