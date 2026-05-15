<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupLoading from '~/components/loadingBar';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsModalCreateGroup from '~/components/group/modal-create-group.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsRowActions from '~/components/row-actions/bs-row-actions.vue';
import { IS_ADMIN, USER } from '~/store/user';
import { Building2, Plus, Pencil, Check, XCircle, Trash2 } from 'lucide-vue';
import { escapeHtml } from '~/helpers/escape-html';

export default {
  name: 'PageGroups',
  components: {
    BsGroupLoading,
    BsPageHeader,
    BsModalCreateGroup,
    BsModalConfirmForm,
    BsDataTable,
    BsRowActions,
    // eslint-disable-next-line vue/no-unused-components
    LucideBuilding2: Building2,
    LucidePlus: Plus,
    LucideCheck: Check,
    LucideXCircle: XCircle,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
    sidebarModule: 'settings',
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
      deletingGroup: null,
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
          width: '90px',
        },
        {
          text: this.$t('tableHeaders.groups.cdnDownload'),
          align: 'center',
          value: 'downloadMailingWithCdnImages',
          sortable: false,
          width: '60px',
        },
        {
          text: this.$t('tableHeaders.groups.ftpDownload'),
          align: 'center',
          value: 'downloadMailingWithFtpImages',
          sortable: false,
          width: '60px',
        },
        {
          text: this.$t('tableHeaders.groups.esp'),
          align: 'center',
          value: 'hasProfiles',
          sortable: false,
          width: '60px',
        },
        {
          text: this.$t('tableHeaders.groups.ai'),
          align: 'center',
          value: 'enableCrmIntelligence',
          sortable: false,
          width: '60px',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          align: 'right',
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
    escapeHtml,
    openCreateModal() {
      this.$refs.createGroupModal.open();
    },
    goToGroup(group) {
      this.$router.push(`/groups/${group.id}/settings/general`);
    },
    buildQuickActions(item) {
      return [
        {
          key: 'edit',
          icon: Pencil,
          text: 'global.edit',
          onClick: () => this.goToGroup(item),
        },
        {
          key: 'delete',
          icon: Trash2,
          text: 'global.delete',
          variant: 'danger',
          onClick: () => this.confirmDelete(item),
        },
      ];
    },
    confirmDelete(group) {
      this.deletingGroup = group;
      this.$refs.deleteDialog.open({ name: group.name, id: group.id });
    },
    async deleteGroup({ id }) {
      try {
        this.loading = true;
        await this.$axios.$delete(apiRoutes.groupsItem({ groupId: id }));
        this.groups = this.groups.filter((g) => g.id !== id);
        this.showSnackbar({
          text: this.$t('snackbars.deleted'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
        this.deletingGroup = null;
      }
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
      const colors = { active: 'success', demo: 'info', inactive: 'grey' };
      return colors[status] || 'grey';
    },
    getStatusLabel(status) {
      const labels = {
        active: this.$t('forms.group.status.active'),
        demo: this.$t('forms.group.status.demo'),
        inactive: this.$t('forms.group.status.inactive'),
      };
      return labels[status] || status;
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
        {{ $t('settingsNav.companiesList') }}
      </template>
      <template #actions>
        <v-btn color="accent" elevation="0" @click="openCreateModal">
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('global.add') }}
        </v-btn>
      </template>
    </bs-page-header>

    <v-container fluid>
      <client-only>
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
            <span class="text--secondary">{{
              item.createdAt | preciseDateTime
            }}</span>
          </template>

          <template #item.status="{ item }">
            <v-chip
              small
              :color="getStatusColor(item.status)"
              :outlined="item.status !== 'active'"
              :dark="item.status === 'active'"
            >
              {{ getStatusLabel(item.status) }}
            </v-chip>
          </template>

          <template #item.downloadMailingWithCdnImages="{ item }">
            <lucide-check
              v-if="item.downloadMailingWithCdnImages"
              :size="16"
              class="accent--text"
            />
            <lucide-x-circle
              v-else
              :size="16"
              class="error--text"
              style="opacity: 0.35"
            />
          </template>

          <template #item.downloadMailingWithFtpImages="{ item }">
            <lucide-check
              v-if="item.downloadMailingWithFtpImages"
              :size="16"
              class="accent--text"
            />
            <lucide-x-circle
              v-else
              :size="16"
              class="error--text"
              style="opacity: 0.35"
            />
          </template>

          <template #item.hasProfiles="{ item }">
            <lucide-check
              v-if="item.hasProfiles"
              :size="16"
              class="accent--text"
            />
            <lucide-x-circle
              v-else
              :size="16"
              class="error--text"
              style="opacity: 0.35"
            />
          </template>

          <template #item.enableCrmIntelligence="{ item }">
            <lucide-check
              v-if="item.enableCrmIntelligence"
              :size="16"
              class="accent--text"
            />
            <lucide-x-circle
              v-else
              :size="16"
              class="error--text"
              style="opacity: 0.35"
            />
          </template>

          <template #item.actions="{ item }">
            <bs-row-actions :quick-actions="buildQuickActions(item)" />
          </template>
        </bs-data-table>

        <bs-modal-confirm-form
          ref="deleteDialog"
          :title="$t('forms.group.dangerZone.deleteTitle')"
          :action-label="$t('global.delete')"
          :confirmation-input-label="$t('groups.delete.confirmationField')"
          :confirm-check-box="true"
          :confirm-check-box-message="$t('groups.delete.deleteNotice')"
          @confirm="deleteGroup"
        >
          <p
            class="black--text"
            v-html="
              $t('groups.delete.deleteWarningMessage', {
                name: escapeHtml(deletingGroup && deletingGroup.name),
              })
            "
          />
        </bs-modal-confirm-form>

        <bs-group-loading slot="placeholder" />
      </client-only>
    </v-container>

    <bs-modal-create-group
      ref="createGroupModal"
      :loading="modalLoading"
      @submit="createGroup"
    />
  </div>
</template>
