<script>
import { mapGetters, mapMutations } from 'vuex';
import { MoreVertical } from 'lucide-vue';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user';
import { SET_ACTIVE_MODULE, SET_LAST_GROUP_ID } from '~/store/sidebar';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import * as userStatusHelpers from '~/helpers/user-status.js';
import { TABLE_ITEMS_PER_PAGE_OPTIONS } from '~/helpers/constants/table-config.js';
import BsMailingsAdminTable from '~/components/mailings/admin-table.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsUserForm from '~/components/users/form.vue';
import BsUserActions from '~/components/user/actions.vue';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';

export default {
  name: 'BsPageUser',
  components: {
    BsUserForm,
    BsMailingsAdminTable,
    BsDataTable,
    BsUserActions,
    BsPageHeader,
    LucideMoreVertical: MoreVertical,
  },
  mixins: [mixinPageTitle],
  TABLE_ITEMS_PER_PAGE_OPTIONS,
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const userResponse = await $axios.$get(apiRoutes.usersItem(params));
      const groupId = userResponse.group?.id;
      const workspacesResponse = groupId
        ? await $axios.$get(apiRoutes.groupsWorkspaces({ groupId }))
        : { items: [] };
      return { user: userResponse, workspaces: workspacesResponse.items };
    } catch (error) {
      console.log(error);
      return { user: {}, workspaces: [] };
    }
  },
  data() {
    return {
      user: {},
      workspaces: [],
      savingWorkspaces: new Set(),
      mailings: [],
      loading: false,
      isLoadingMailings: false,
      pagination: {
        page: 1,
        itemsPerPage: 25,
        itemsLength: 0,
        pageCount: 0,
        pageStart: 0,
        pageStop: 0,
      },
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    title() {
      return `${this.$tc('global.user', 1)} – ${this.user.name}`;
    },
    pageTitle() {
      return this.user.name || this.$tc('global.user', 1);
    },
    groupName() {
      return this.user.group?.name || '';
    },
    showGroupBadge() {
      return this.isAdmin && this.groupName;
    },
    statusIcon() {
      return userStatusHelpers.getStatusIcon(this.user.status);
    },
    statusLabel() {
      return this.$options.filters.userStatus(this.user);
    },
    actionDisplay() {
      return userStatusHelpers.getStatusActions(this.user.status);
    },
    workspaceHeaders() {
      return [
        { text: this.$t('global.name'), value: 'name', align: 'left' },
        {
          text: this.$t('tableHeaders.workspaces.assigned'),
          value: 'assigned',
          align: 'center',
          sortable: false,
          width: '120px',
        },
      ];
    },
  },
  watch: {
    'pagination.page': 'loadMailings',
    'pagination.itemsPerPage': 'loadMailings',
  },
  mounted() {
    // Sidebar lives outside this page; tell it which group context applies
    // and force the SETTINGS module so navigation stays coherent on /users/:id.
    this.$store.commit(`sidebar/${SET_ACTIVE_MODULE}`, 'settings');
    if (this.user?.group?.id) {
      this.$store.commit(`sidebar/${SET_LAST_GROUP_ID}`, this.user.group.id);
    }
    this.loadMailings();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    isUserInWorkspace(workspace) {
      return (workspace._users || []).some(
        (id) => String(id) === String(this.user.id)
      );
    },
    async toggleWorkspace(workspace) {
      const userId = String(this.user.id);
      const currentUsers = (workspace._users || []).map(String);
      const isAssigned = currentUsers.includes(userId);
      const newUsers = isAssigned
        ? currentUsers.filter((id) => id !== userId)
        : [...currentUsers, userId];

      this.savingWorkspaces = new Set([...this.savingWorkspaces, workspace.id]);
      try {
        await this.$axios.$put(apiRoutes.getWorkspace(workspace.id), {
          selectedUsers: newUsers.map((id) => ({ id })),
        });
        const idx = this.workspaces.findIndex((w) => w.id === workspace.id);
        if (idx !== -1) {
          this.$set(this.workspaces[idx], '_users', newUsers);
        }
      } catch {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        const next = new Set(this.savingWorkspaces);
        next.delete(workspace.id);
        this.savingWorkspaces = next;
      }
    },
    async loadMailings() {
      this.isLoadingMailings = true;
      try {
        const {
          $axios,
          $route: { params },
        } = this;
        const response = await $axios.$get(
          apiRoutes.usersItemMailings(params),
          {
            params: {
              page: this.pagination.page,
              limit: this.pagination.itemsPerPage,
            },
          }
        );
        this.mailings = response.items;
        this.pagination.itemsLength = response.totalItems;
        this.pagination.pageCount = response.totalPages;
        this.pagination.pageStart =
          (this.pagination.page - 1) * this.pagination.itemsPerPage;
        this.pagination.pageStop =
          this.pagination.pageStart + this.mailings.length;
      } catch (error) {
        console.error('Error fetching mailings for user:', error);
      } finally {
        this.isLoadingMailings = false;
      }
    },
    handleItemsPerPageChange(itemsPerPage) {
      this.pagination.page = 1;
      this.pagination.itemsPerPage = itemsPerPage;
    },
    async updateUser() {
      this.loading = true;
      try {
        const { $axios, $route } = this;
        const { params } = $route;
        await $axios.$put(apiRoutes.usersItem(params), this.user);
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
        this.mixinPageTitleUpdateTitle(this.title);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
    activateUser() {
      this.$refs.userActions.activate(this.user);
    },
    deactivateUser() {
      this.$refs.userActions.deactivate(this.user);
    },
    resetPassword() {
      this.$refs.userActions.resetPassword(this.user);
    },
    sendPassword() {
      this.$refs.userActions.sendPassword(this.user);
    },
    reSendPassword() {
      this.$refs.userActions.resendPassword(this.user);
    },
    updateUserFromActions(updatedUser) {
      this.user = updatedUser;
      this.mixinPageTitleUpdateTitle(this.title);
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
        {{ pageTitle }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ groupName }}
        </v-chip>
      </template>
      <template #actions>
        <v-chip small outlined>
          <v-icon v-if="statusIcon" left small>
            {{ statusIcon }}
          </v-icon>
          {{ statusLabel }}
        </v-chip>
        <v-menu offset-y left>
          <template #activator="{ on, attrs }">
            <v-btn icon :disabled="loading" v-bind="attrs" v-on="on">
              <lucide-more-vertical :size="20" />
            </v-btn>
          </template>
          <v-list dense>
            <v-list-item
              v-if="actionDisplay.activate"
              link
              @click="activateUser"
            >
              <v-list-item-icon class="mr-3">
                <v-icon color="accent"> accessibility </v-icon>
              </v-list-item-icon>
              <v-list-item-title>{{ $t('global.enable') }}</v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="actionDisplay.sendPassword"
              link
              @click="sendPassword"
            >
              <v-list-item-icon class="mr-3">
                <v-icon color="accent"> vpn_key </v-icon>
              </v-list-item-icon>
              <v-list-item-title>
                {{ $t('users.passwordTooltip.send') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="actionDisplay.reSendPassword"
              link
              @click="reSendPassword"
            >
              <v-list-item-icon class="mr-3">
                <v-icon color="accent"> vpn_key </v-icon>
              </v-list-item-icon>
              <v-list-item-title>
                {{ $t('users.passwordTooltip.resend') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="actionDisplay.resetPassword"
              link
              @click="resetPassword"
            >
              <v-list-item-icon class="mr-3">
                <v-icon color="accent"> vpn_key </v-icon>
              </v-list-item-icon>
              <v-list-item-title>
                {{ $t('users.passwordTooltip.reset') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="!user.isDeactivated"
              link
              @click="deactivateUser"
            >
              <v-list-item-icon class="mr-3">
                <v-icon color="accent"> airline_seat_individual_suite </v-icon>
              </v-list-item-icon>
              <v-list-item-title>{{ $t('global.disable') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </bs-page-header>

    <v-container fluid>
      <bs-user-form
        v-model="user"
        :title="$t('users.details')"
        :loading="loading"
        @submit="updateUser"
      />

      <v-card flat tile class="mt-4">
        <v-card-title class="px-0">
          {{ $tc('global.teams', 2) }}
        </v-card-title>
        <bs-data-table :headers="workspaceHeaders" :items="workspaces">
          <template #item.name="{ item }">
            <span class="font-weight-medium">{{ item.name }}</span>
          </template>
          <template #item.assigned="{ item }">
            <v-switch
              :input-value="isUserInWorkspace(item)"
              :loading="savingWorkspaces.has(item.id)"
              :disabled="savingWorkspaces.has(item.id)"
              dense
              hide-details
              class="mt-0 d-inline-flex"
              @change="toggleWorkspace(item)"
            />
          </template>
        </bs-data-table>
      </v-card>

      <v-card flat tile class="mt-4">
        <v-card-title class="px-0">
          {{ $tc('global.mailing', 2) }}
        </v-card-title>
        <bs-mailings-admin-table
          :mailings="mailings"
          :loading="isLoadingMailings"
          :options="pagination || {}"
          :hidden-cols="[`userName`]"
          :footer-props="{
            pagination,
            disablePagination: true,
            prevIcon: 'none',
            nextIcon: 'none',
            itemsPerPageOptions: $options.TABLE_ITEMS_PER_PAGE_OPTIONS,
            itemsPerPageAllText: 'Tout',
          }"
          @update:items-per-page="handleItemsPerPageChange"
        />
        <div class="d-flex align-center justify-center">
          <v-pagination
            v-if="pagination && pagination.itemsLength > 0"
            v-model="pagination.page"
            :circle="true"
            class="my-4 pagination-custom-style"
            :length="pagination.pageCount"
          />
        </div>
      </v-card>

      <bs-user-actions
        ref="userActions"
        v-model="loading"
        :user="user"
        @update="updateUserFromActions"
      />
    </v-container>
  </div>
</template>
