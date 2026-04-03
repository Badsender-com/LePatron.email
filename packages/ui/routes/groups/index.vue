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

export default {
  name: 'PageGroups',
  components: {
    BsGroupLoading,
    BsGroupSettingsPageHeader,
    BsCompaniesNav,
    BsModalCreateGroup,
    BsDataTable,
    LucideBuilding2: Building2,
    LucidePencil: Pencil,
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
        { text: this.$t('global.createdAt'), align: 'left', value: 'createdAt' },
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
              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <v-btn
                    icon
                    small
                    v-bind="attrs"
                    v-on="on"
                    @click.stop="goToGroup(item)"
                  >
                    <lucide-pencil :size="18" />
                  </v-btn>
                </template>
                <span>{{ $t('global.edit') }}</span>
              </v-tooltip>
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

<style scoped>
.settings-content {
  padding: 0;
}
</style>
