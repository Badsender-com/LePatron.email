<script>
import { mapGetters } from 'vuex';
import BsUserActions from '~/components/user/actions.vue';
import { Roles, getRoleLabelKey } from '~/helpers/constants/roles';
import {
  roleChip,
  roleRank,
  mailActionOf,
  rowActionKeys,
} from '~/helpers/user-row-actions.js';
import { USER, USER_CAPABILITIES } from '~/store/user';
import { Users, Pencil, Send, UserCheck, UserX, RotateCcw } from 'lucide-vue';
import BsRowActions from '~/components/row-actions/bs-row-actions.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';

export default {
  name: 'BsUsersTable',
  components: {
    BsDataTable,
    BsUserActions,
    BsRowActions,
    LucideUsers: Users,
  },
  model: { prop: 'loading', event: 'update:loading' },
  props: {
    users: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      selectedUser: { group: {} },
    };
  },
  computed: {
    ...mapGetters(USER, { capabilities: USER_CAPABILITIES }),
    tableHeaders() {
      // Columns are styled by class, not by position: callers hide columns.
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        {
          text: this.$t('users.email'),
          align: 'left',
          value: 'email',
          cellClass: 'col-email',
        },
        {
          text: this.$t('users.role'),
          value: 'role',
          align: 'center',
          width: '130px',
          sort: (a, b) => roleRank(a) - roleRank(b),
          cellClass: 'col-role',
        },
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
          cellClass: 'col-status',
        },
        {
          text: this.$t('users.lang'),
          value: 'lang',
          align: 'center',
          cellClass: 'col-lang',
        },
        {
          text: this.$t('global.createdAt'),
          value: 'createdAt',
          cellClass: 'col-created-at',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
          width: '140px',
          class: 'col-actions',
          cellClass: 'col-actions',
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    localLoading: {
      get() {
        return this.loading;
      },
      set(newLoading) {
        this.$emit('update:loading', newLoading);
      },
    },
  },
  methods: {
    // A super admin is managed from the super admins screen and the global
    // user page, never from their group's settings (ADR 0002).
    userPath(user) {
      const groupId = user.group?.id || this.$route.params.groupId;
      return groupId && user.role !== Roles.SUPER_ADMIN
        ? `/groups/${groupId}/settings/users/${user.id}`
        : `/users/${user.id}`;
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
    getRoleChip(role) {
      return roleChip(role);
    },
    getRoleLabel(role) {
      if (role === Roles.SUPER_ADMIN)
        return this.$t('users.roles.chip.superAdmin');
      if (role === Roles.GROUP_ADMIN)
        return this.$t('users.roles.chip.groupAdmin');
      const labelKey = getRoleLabelKey(role);
      return labelKey ? this.$t(labelKey) : role;
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
      this.$router.push(this.userPath(user));
    },
    // `text` is an i18n KEY: BsRowActions translates it.
    buildQuickActions(item) {
      const mail = mailActionOf(item.status);
      const MAIL_METHODS = {
        resetPassword: this.resetPassword,
        sendPassword: this.sendPassword,
        reSendPassword: this.resendPassword,
      };
      const ACTIONS = {
        activate: {
          icon: UserCheck,
          text: 'global.enable',
          onClick: () => this.activate(item),
        },
        deactivate: {
          icon: UserX,
          text: 'global.disable',
          onClick: () => this.deactivate(item),
        },
        'mail-action': mail && {
          icon: mail.action === 'resetPassword' ? RotateCcw : Send,
          text: mail.textKey,
          onClick: () => MAIL_METHODS[mail.action](item),
        },
        edit: {
          icon: Pencil,
          text: 'global.edit',
          onClick: () => this.navigateToUser(item),
        },
      };
      return rowActionKeys(item, this.capabilities).map((key) => ({
        key,
        ...ACTIONS[key],
      }));
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
          v-if="item.role"
          x-small
          :color="getRoleChip(item.role).color"
          :text-color="getRoleChip(item.role).textColor"
        >
          {{ getRoleLabel(item.role) }}
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
  ::v-deep .v-data-table tbody td.col-email {
    font-family: var(--font-mono);
    font-size: 12px !important;
  }

  ::v-deep .v-data-table tbody td.col-role {
    text-align: center;

    .v-chip {
      font-size: 10px !important;
      height: 18px !important;
      padding: 0 6px !important;
      font-weight: 600 !important;
    }
  }

  ::v-deep .v-data-table tbody td.col-status {
    text-align: center;

    .v-chip {
      font-size: 11px !important;
      height: 20px !important;
      padding: 0 8px !important;
      font-weight: 500 !important;
    }
  }

  ::v-deep .v-data-table tbody td.col-lang {
    text-align: center;
    color: rgba(0, 0, 0, 0.54) !important;
    font-weight: 600 !important;
    font-size: 11px !important;
  }

  ::v-deep .v-data-table tbody td.col-created-at {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  ::v-deep .v-data-table tbody td.col-actions,
  ::v-deep .v-data-table thead th.col-actions {
    text-align: right !important;
    width: 140px;
    white-space: nowrap;
  }
}
</style>
