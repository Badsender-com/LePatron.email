<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import BsUserTableActionsMail from '~/components/users/table-actions-mail.vue';
import BsUserTableActionsActivation from '~/components/users/table-actions-activation.vue';
import BsUserActions from '~/components/user/actions.vue';

export default {
  name: `bs-users-table`,

  components: {
    BsUserTableActionsMail,
    BsUserTableActionsActivation,
    BsUserActions,
  },
  model: { prop: `loading`, event: `update` },
  props: {
    users: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  data() {
    return { selectedUser: { group: {} } };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('users.email'), align: `left`, value: `email` },
        { text: this.$t('global.name'), align: `left`, value: `name` },
        {
          text: this.$tc('global.group', 1),
          align: `left`,
          value: `group`,
          sort: (a, b) => String(b.name).localeCompare(a.name),
        },
        {
          text: this.$t('global.status'),
          value: `status`,
          class: `table-column-action`,
        },
        { text: ``, align: `left`, value: `statusText`, sortable: false },
        { text: this.$t('users.lang'), value: `lang` },
        { text: this.$t('global.createdAt'), value: `createdAt` },
        {
          text: this.$t('global.password'),
          value: `actionSendPasswordMail`,
          sortable: false,
          align: `center`,
          class: `table-column-action`,
        },
        {
          text: this.$t('global.disable'),
          value: `actionDelete`,
          sortable: false,
          align: `center`,
          class: `table-column-action`,
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    localLoading: {
      get() {
        return this.loading;
      },
      set(newLoading) {
        this.$emit(`update`, newLoading);
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
      this.$emit(`update`, user);
    },
  },
};
</script>

<template>
  <div class="bs-users-table">
    <v-data-table
      :headers="tableHeaders"
      :items="users"
      class="elevation-1"
      :loading="loading"
    >
      <template v-slot:item.email="{ item }">
        <nuxt-link :to="`/users/${item.id}`">{{ item.email }}</nuxt-link>
      </template>
      <template v-slot:item.group="{ item }">
        <nuxt-link :to="`/groups/${item.group.id}`">{{
          item.group.name
        }}</nuxt-link>
      </template>
      <template v-slot:item.status="{ item }">
        <v-icon>{{ getStatusIcon(item) }}</v-icon>
      </template>
      <template v-slot:item.statusText="{ item }">
        <span>{{ item | userStatus }}</span>
      </template>
      <template v-slot:item.createdAt="{ item }">
        <span>{{ item.createdAt | preciseDateTime }}</span>
      </template>
      <template v-slot:item.actionSendPasswordMail="{ item }">
        <bs-user-table-actions-mail
          :user="item"
          :loading="loading"
          @resetPassword="resetPassword"
          @sendPassword="sendPassword"
          @resendPassword="resendPassword"
        />
        <!-- <v-btn @click="mailAction(item)" :disabled="loading" icon color="primary">
        <v-icon>airline_seat_individual_suite</v-icon>
        </v-btn>-->
      </template>
      <template v-slot:item.actionDelete="{ item }">
        <bs-user-table-actions-activation
          :user="item"
          :loading="loading"
          @activate="activate"
          @deactivate="deactivate"
        />
      </template>
    </v-data-table>
    <bs-user-actions
      :user="selectedUser"
      v-model="localLoading"
      ref="userActions"
      @update="updateUserFromActions"
    />
  </div>
</template>
