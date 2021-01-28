<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import * as userStatusHelpers from '~/helpers/user-status.js';

export default {
  name: `bs-user-menu`,
  props: {
    user: { type: Object, default: () => ({ group: {} }) },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      dialog: false,
      dialogTitle: ``,
      dialogText: ``,
      dialogButton: ``,
      dialogEventName: ``,
    };
  },
  computed: {
    statusIcon() {
      return userStatusHelpers.getStatusIcon(this.user.status);
    },
    actionDisplay() {
      console.log({ user: this.user })
      return userStatusHelpers.getStatusActions(this.user.status);
    },
  },
  methods: {
    showActivateDialog() {
      this.$emit(`activate`);
    },
    showDeactivateDialog() {
      this.$emit(`deactivate`);
    },
    showResetPasswordDialog() {
      this.$emit(`resetPassword`);
    },
    showSendPasswordDialog() {
      this.$emit(`sendPassword`);
    },
    showReSendPasswordDialog() {
      this.$emit(`resendPassword`);
    },
  },
};
</script>

<template>
  <v-list>
    <v-subheader>{{ $tc('global.group', 1) }}</v-subheader>
    <v-list-item link nuxt :to="`/groups/${user.group.id}`" :disabled="loading">
      <v-list-item-avatar>
        <v-icon>group</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{ user.group.name }}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-subheader>{{ $t('global.actions') }}</v-subheader>
    <v-list-item
      link
      v-if="user.isDeactivated"
      @click.stop="showActivateDialog"
    >
      <v-list-item-avatar>
        <v-icon>accessibility</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{ $t('global.enable') }}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <template v-if="!user.isDeactivated">
      <!-- send password -->
      <v-list-item
        link
        v-if="actionDisplay.sendPassword"
        @click.stop="showSendPasswordDialog"
      >
        <v-list-item-avatar>
          <v-icon>vpn_key</v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>{{
            $t('users.passwordTooltip.send')
          }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <!-- re-send password -->
      <v-list-item
        link
        v-if="actionDisplay.reSendPassword"
        @click.stop="showReSendPasswordDialog"
      >
        <v-list-item-avatar>
          <v-icon>vpn_key</v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>{{
            $t('users.passwordTooltip.resend')
          }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <!-- reset password -->
      <v-list-item
        link
        v-if="actionDisplay.resetPassword"
        @click.stop="showResetPasswordDialog"
      >
        <v-list-item-avatar>
          <v-icon>vpn_key</v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>{{
            $t('users.passwordTooltip.reset')
          }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <!-- deactivate -->
      <v-list-item
        link
        @click.stop="showDeactivateDialog"
        :disabled="loading"
        color="primary"
      >
        <v-list-item-avatar>
          <v-icon>airline_seat_individual_suite</v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>{{ $t('global.disable') }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </template>
    <v-subheader>{{ $t('global.status') }}</v-subheader>
    <v-list-item>
      <v-list-item-avatar>
        <v-icon>{{ statusIcon }}</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{ user | userStatus }}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>
