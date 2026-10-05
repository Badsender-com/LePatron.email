<script>
import { mapMutations } from 'vuex';
import { Plus, UserPlus } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { Roles } from '~/helpers/constants/roles';
import { superAdminErrorMessage } from '~/helpers/super-admin-errors.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsUsersTable from '~/components/users/table.vue';
import BsModalCreateSuperAdmin from '~/components/super-admins/modal-create-super-admin.vue';
import BsModalPromoteMember from '~/components/super-admins/modal-promote-member.vue';

// The super admins live in the platform group (ADR 0002) but are managed
// here, not from that group's users tab, where they do not appear.
export default {
  name: 'PageSuperAdmins',
  components: {
    BsPageHeader,
    BsUsersTable,
    BsModalCreateSuperAdmin,
    BsModalPromoteMember,
    LucidePlus: Plus,
    LucideUserPlus: UserPlus,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData({ $axios }) {
    try {
      // The groups listing is the one the company switcher already loads
      // for a super admin; the platform group is the one flagged in it.
      const [usersResponse, groupsResponse] = await Promise.all([
        $axios.$get(apiRoutes.users(), {
          params: { role: Roles.SUPER_ADMIN },
        }),
        $axios.$get(apiRoutes.groups()),
      ]);
      return {
        superAdmins: usersResponse.items,
        platformGroup:
          groupsResponse.items.find((group) => group.isPlatform) || null,
        loadError: false,
      };
    } catch (error) {
      console.error(error);
      return { superAdmins: [], platformGroup: null, loadError: true };
    }
  },
  data() {
    return {
      superAdmins: [],
      platformGroup: null,
      loadError: false,
      members: [],
      loading: false,
      membersLoading: false,
      modalLoading: false,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$t('superAdmins.pageTitle');
    },
    canAct() {
      return !this.loadError && !!this.platformGroup;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    openCreateModal() {
      this.$refs.createModal.open();
    },
    async openPromoteModal() {
      try {
        this.membersLoading = true;
        const response = await this.$axios.$get(
          apiRoutes.groupsItemUsers({ groupId: this.platformGroup.id })
        );
        this.members = response.items;
        this.$refs.promoteModal.open();
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.membersLoading = false;
      }
    },
    async createSuperAdmin(user) {
      try {
        this.modalLoading = true;
        const created = await this.$axios.$post(apiRoutes.users(), {
          ...user,
          role: Roles.SUPER_ADMIN,
        });
        this.superAdmins = [created, ...this.superAdmins];
        this.$refs.createModal.close();
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.modalLoading = false;
      }
    },
    async promoteMember(userId) {
      try {
        this.modalLoading = true;
        const promoted = await this.$axios.$put(
          apiRoutes.usersItem({ userId }),
          { role: Roles.SUPER_ADMIN }
        );
        this.superAdmins = [promoted, ...this.superAdmins];
        this.$refs.promoteModal.close();
        this.showSnackbar({
          text: this.$t('superAdmins.promoted'),
          color: 'success',
        });
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.modalLoading = false;
      }
    },
    onUserUpdated(updated) {
      const index = this.superAdmins.findIndex(
        (user) => user.id === updated.id
      );
      if (index !== -1) this.$set(this.superAdmins, index, updated);
    },
    notifyError(error) {
      this.showSnackbar({
        text: superAdminErrorMessage(this, error),
        color: 'error',
      });
      console.error(error);
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
      <template #actions>
        <v-btn
          outlined
          color="primary"
          :disabled="!canAct"
          :loading="membersLoading"
          @click="openPromoteModal"
        >
          <lucide-user-plus :size="18" class="mr-2" />
          {{ $t('superAdmins.promote') }}
        </v-btn>
        <v-btn
          color="accent"
          elevation="0"
          :disabled="!canAct"
          @click="openCreateModal"
        >
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('superAdmins.add') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <v-alert v-if="loadError" type="error" outlined text>
        {{ $t('superAdmins.loadError') }}
      </v-alert>
      <v-alert v-else-if="!platformGroup" type="warning" outlined text>
        {{ $t('superAdmins.noPlatformGroup') }}
      </v-alert>
      <bs-users-table
        v-model="loading"
        :users="superAdmins"
        :hidden-cols="['group', 'role']"
        @update="onUserUpdated"
      />
      <bs-modal-create-super-admin
        ref="createModal"
        :loading="modalLoading"
        @submit="createSuperAdmin"
      />
      <bs-modal-promote-member
        ref="promoteModal"
        :loading="modalLoading"
        :members="members"
        @submit="promoteMember"
      />
    </v-container>
  </div>
</template>
