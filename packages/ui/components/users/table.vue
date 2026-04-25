<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import BsUserActions from '~/components/user/actions.vue';
import { Roles } from '~/helpers/constants/roles';
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
import { Users, Pencil, Send, UserCheck, UserX, RotateCcw } from 'lucide-vue';
import BsRowActions from '~/components/row-actions/BsRowActions.vue';

export default {
  name: 'BsUsersTable',
  components: {
    BsUserActions,
    BsRowActions,
    LucideUsers: Users,
  },
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
  model: { prop: 'loading', event: 'update' },
  props: {
    users: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      selectedUser: { group: {} },
      roles: Roles,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('users.email'), align: 'left', value: 'email' },
        { text: '', value: 'role', sortable: false, width: '80px' },
        {
          text: this.$tc('global.group', 1),
          align: 'left',
          value: 'group',
          sort: (a, b) => String(b.name).localeCompare(a.name),
        },
        {
          text: this.$t('global.status'),
          value: 'status',
          align: 'center',
        },
        { text: this.$t('users.lang'), value: 'lang', align: 'center' },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'center',
          width: '140px',
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    localLoading: {
      get() {
        return this.loading;
      },
      set(newLoading) {
        this.$emit('update', newLoading);
      },
    },
  },
  methods: {
    getStatusActions(status) {
      return userStatusHelpers.getStatusActions(status);
    },
    getStatusColor(status) {
      const colors = {
        confirmed: 'success',
        'saml-authentication': 'success',
        'password-mail-sent': 'info',
        'to-be-initialized': 'warning',
        deactivated: 'grey',
      };
      return colors[status] || 'grey';
    },
    getStatusLabel(status) {
      const labels = {
        confirmed: this.$t('users.status.confirmed'),
        'saml-authentication': this.$t('users.status.saml'),
        'password-mail-sent': this.$t('users.status.passwordSent'),
        'to-be-initialized': this.$t('users.status.toInitialize'),
        deactivated: this.$t('users.status.deactivated'),
      };
      return labels[status] || status;
    },
    isActiveStatus(status) {
      return status === 'confirmed' || status === 'saml-authentication';
    },
    resetPassword(user) {
      this.selectedUser = user;
      this.$refs.userActions.resetPassword();
    },
    sendPassword(user) {
      this.selectedUser = user;
      this.$refs.userActions.sendPassword();
    },
    resendPassword(user) {
      this.selectedUser = user;
      this.$refs.userActions.resendPassword();
    },
    activate(user) {
      this.selectedUser = user;
      this.$refs.userActions.activate();
    },
    deactivate(user) {
      this.selectedUser = user;
      this.$refs.userActions.deactivate();
    },
    updateUserFromActions(user) {
      this.$emit('update', user);
    },
    navigateToUser(user) {
      // Navigate to user edit page within the group settings structure
      const groupId = user.group?.id || this.$route.params.groupId;
      if (groupId) {
        this.$router.push(`/groups/${groupId}/settings/users/${user.id}`);
      } else {
        // Fallback for legacy route
        this.$router.push(`/users/${user.id}`);
      }
    },
    getMailActionTooltip(status) {
      const actions = this.getStatusActions(status);
      if (actions.resetPassword) return this.$t('users.passwordTooltip.reset');
      if (actions.sendPassword) return this.$t('users.passwordTooltip.send');
      if (actions.reSendPassword)
        return this.$t('users.passwordTooltip.resend');
      return '';
    },
    handleMailAction(user) {
      const actions = this.getStatusActions(user.status);
      if (actions.resetPassword) return this.resetPassword(user);
      if (actions.sendPassword) return this.sendPassword(user);
      if (actions.reSendPassword) return this.resendPassword(user);
    },
    showMailAction(status) {
      const actions = this.getStatusActions(status);
      return (
        actions.resetPassword || actions.sendPassword || actions.reSendPassword
      );
    },
    /**
     * Build quick actions for a user row
     * Design System: Activation/Deactivation toggle, Send/Reset password, Edit
     */
    buildQuickActions(item) {
      const actions = [];
      const statusActions = this.getStatusActions(item.status);

      // 1. Activation/Deactivation toggle
      if (statusActions.activate) {
        actions.push({
          key: 'activate',
          icon: UserCheck,
          text: 'global.enable',
          onClick: () => this.activate(item),
        });
      } else if (item.status !== 'to-be-initialized') {
        actions.push({
          key: 'deactivate',
          icon: UserX,
          text: 'global.disable',
          onClick: () => this.deactivate(item),
        });
      }

      // 2. Password/Mail actions
      if (this.showMailAction(item.status)) {
        const isReset = statusActions.resetPassword;
        actions.push({
          key: 'mail-action',
          icon: isReset ? RotateCcw : Send,
          text: this.getMailActionTooltip(item.status),
          onClick: () => this.handleMailAction(item),
        });
      }

      // 3. Edit
      actions.push({
        key: 'edit',
        icon: Pencil,
        text: 'global.edit',
        onClick: () => this.navigateToUser(item),
      });

      return actions;
    },
  },
};
</script>

<template>
  <!-- eslint-disable vue/valid-v-slot  -->
  <div class="bs-users-table">
    <v-data-table
      :headers="tableHeaders"
      :items="users"
      :loading="loading"
      :items-per-page="25"
      :hide-default-footer="users.length <= $options.TABLE_PAGINATION_THRESHOLD"
      :footer-props="$options.TABLE_FOOTER_PROPS"
      class="users-table"
      @click:row="navigateToUser"
    >
      <template #item.name="{ item }">
        <span class="font-weight-medium">{{ item.name }}</span>
      </template>

      <template #item.email="{ item }">
        <span class="text--secondary">{{ item.email }}</span>
      </template>

      <template #item.role="{ item }">
        <v-chip
          v-if="item.role === roles.GROUP_ADMIN"
          x-small
          color="accent"
          dark
        >
          Admin
        </v-chip>
      </template>

      <template #item.group="{ item }">
        <span>{{ item.group.name }}</span>
      </template>

      <template #item.status="{ item }">
        <v-chip
          small
          :color="getStatusColor(item.status)"
          :outlined="!isActiveStatus(item.status)"
          :dark="isActiveStatus(item.status)"
        >
          {{ getStatusLabel(item.status) }}
        </v-chip>
      </template>

      <template #item.lang="{ item }">
        <span class="text-uppercase text--secondary">{{ item.lang }}</span>
      </template>

      <template #item.createdAt="{ item }">
        <span class="text--secondary">{{
          item.createdAt | preciseDateTime
        }}</span>
      </template>

      <template #item.actions="{ item }">
        <bs-row-actions :quick-actions="buildQuickActions(item)" />
      </template>

      <template #no-data>
        <div class="text-center pa-6">
          <lucide-users :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4">
            {{ $t('users.noUsersAvailable') }}
          </p>
        </div>
      </template>
    </v-data-table>
    <bs-user-actions
      ref="userActions"
      v-model="localLoading"
      :user="selectedUser"
      @update="updateUserFromActions"
    />
  </div>
</template>

<style lang="scss" scoped>
.users-table {
  ::v-deep tbody tr {
    cursor: pointer;

    &:hover {
      background-color: rgba(0, 172, 220, 0.05) !important;
    }
  }
}
</style>
