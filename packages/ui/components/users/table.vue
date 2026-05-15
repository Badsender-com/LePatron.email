<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import BsUserActions from '~/components/user/actions.vue';
import { Roles } from '~/helpers/constants/roles';
import { Users, Pencil, Send, UserCheck, UserX, RotateCcw } from 'lucide-vue';
import BsRowActions from '~/components/row-actions/BsRowActions.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';

export default {
  name: 'BsUsersTable',
  components: {
    BsDataTable,
    BsUserActions,
    BsRowActions,
    LucideUsers: Users,
  },
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
        { text: this.$t('global.status'), value: 'status', align: 'center' },
        { text: this.$t('users.lang'), value: 'lang', align: 'center' },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
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
    userPath(user) {
      const groupId = user.group?.id || this.$route.params.groupId;
      return groupId
        ? `/groups/${groupId}/settings/users/${user.id}`
        : `/users/${user.id}`;
    },
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
      const groupId = user.group?.id || this.$route.params.groupId;
      if (groupId) {
        this.$router.push(`/groups/${groupId}/settings/users/${user.id}`);
      } else {
        this.$router.push(`/users/${user.id}`);
      }
    },
    // Returns the i18n KEY, not the translated string: BsRowActions calls
    // $t(action.text) on its side, so returning $t(...) here would translate
    // twice and fall back to the literal string in every locale.
    getMailActionTooltipKey(status) {
      const actions = this.getStatusActions(status);
      if (actions.resetPassword) return 'users.passwordTooltip.reset';
      if (actions.sendPassword) return 'users.passwordTooltip.send';
      if (actions.reSendPassword) return 'users.passwordTooltip.resend';
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
    buildQuickActions(item) {
      const actions = [];
      const statusActions = this.getStatusActions(item.status);

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

      if (this.showMailAction(item.status)) {
        const isReset = statusActions.resetPassword;
        actions.push({
          key: 'mail-action',
          icon: isReset ? RotateCcw : Send,
          text: this.getMailActionTooltipKey(item.status),
          onClick: () => this.handleMailAction(item),
        });
      }

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
    <bs-data-table
      :headers="tableHeaders"
      :items="users"
      :loading="loading"
      clickable
      class="users-table"
      @click:row="navigateToUser"
    >
      <template #item.name="{ item }">
        <nuxt-link
          :to="userPath(item)"
          class="cell-link font-weight-medium"
          @click.native.stop
        >
          {{ item.name }}
        </nuxt-link>
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

      <template #empty>
        <div class="text-center pa-6">
          <lucide-users :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4">
            {{ $t('users.noUsersAvailable') }}
          </p>
        </div>
      </template>
    </bs-data-table>
    <bs-user-actions
      ref="userActions"
      v-model="localLoading"
      :user="selectedUser"
      @update="updateUserFromActions"
    />
  </div>
</template>

<style lang="scss" scoped>
/* Real <a>/<nuxt-link> on the name cell so middle-click opens in a new
   tab. Style has to mimic a plain text cell. */
.cell-link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  border-radius: 2px;

  &:hover {
    text-decoration: underline;
    color: var(--v-primary-base);
  }
}

.bs-users-table {
  /* Email column */
  ::v-deep .v-data-table tbody td:nth-child(2) {
    font-family: var(--font-mono);
    font-size: 12px !important;
  }

  /* Role column */
  ::v-deep .v-data-table tbody td:nth-child(3) {
    text-align: center;

    .v-chip {
      font-size: 10px !important;
      height: 18px !important;
      padding: 0 6px !important;
      font-weight: 600 !important;
    }
  }

  /* Status column */
  ::v-deep .v-data-table tbody td:nth-child(5) {
    text-align: center;

    .v-chip {
      font-size: 11px !important;
      height: 20px !important;
      padding: 0 8px !important;
      font-weight: 500 !important;
    }
  }

  /* Lang column */
  ::v-deep .v-data-table tbody td:nth-child(6) {
    text-align: center;
    color: rgba(0, 0, 0, 0.54) !important;
    font-weight: 600 !important;
    font-size: 11px !important;
  }

  /* CreatedAt column */
  ::v-deep .v-data-table tbody td:nth-child(7) {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Actions column */
  ::v-deep .v-data-table tbody td:last-child,
  ::v-deep .v-data-table thead th:last-child {
    text-align: right !important;
    width: 140px;
    white-space: nowrap;
  }
}
</style>
