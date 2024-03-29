<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import BsUserActions from '~/components/user/actions.vue';
import BsActionsDropdown from '~/components/users/actions-dropdown';
import { Roles } from '~/helpers/constants/roles';

export default {
  name: 'BsUsersTable',
  components: {
    BsActionsDropdown,
    BsUserActions,
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
        { text: this.$t('users.email'), align: 'left', value: 'email' },
        { text: '', value: 'role' },
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        {
          text: this.$tc('global.group', 1),
          align: 'left',
          value: 'group',
          sort: (a, b) => String(b.name).localeCompare(a.name),
        },
        {
          text: this.$t('global.status'),
          value: 'status',
          class: 'table-column-action',
        },
        { text: '', align: 'left', value: 'statusText', sortable: false },
        { text: this.$t('users.lang'), value: 'lang' },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'center',
          class: 'table-column-action',
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
    getStatusIcon(item) {
      return userStatusHelpers.getStatusIcon(item.status);
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
  },
};
</script>

<template>
  <!-- eslint-disable vue/valid-v-slot  -->
  <div class="bs-users-table">
    <v-data-table :headers="tableHeaders" :items="users" :loading="loading">
      <template #item.email="{ item }">
        <nuxt-link :to="`/users/${item.id}`">
          {{ item.email }}
        </nuxt-link>
      </template>
      <template #item.role="{ item }">
        <v-badge
          v-if="item.role === roles.GROUP_ADMIN"
          inline
          color="accent"
          content="Admin"
        />
      </template>
      <template #item.group="{ item }">
        <nuxt-link :to="`/groups/${item.group.id}`">
          {{ item.group.name }}
        </nuxt-link>
      </template>
      <template #item.status="{ item }">
        <v-icon color="accent">
          {{ getStatusIcon(item) }}
        </v-icon>
      </template>
      <template #item.statusText="{ item }">
        <span>{{ item | userStatus }}</span>
      </template>
      <template #item.createdAt="{ item }">
        <span>{{ item.createdAt | preciseDateTime }}</span>
      </template>
      <template #item.actions="{ item }">
        <bs-actions-dropdown
          :user="item"
          :loading="loading"
          :activate="activate"
          :deactivate="deactivate"
          :reset-password="resetPassword"
          :send-password="sendPassword"
          :resend-password="resendPassword"
        />
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
