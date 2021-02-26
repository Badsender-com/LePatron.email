<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import BsUsersTableActionsActivation from "~/components/users/table-actions-activation";
import BsUserTableActionsMail from '~/components/users/table-actions-mail.vue';

export default {
  name: `bs-actions-dropdown`,
  components: {
    BsUsersTableActionsActivation,
    BsUserTableActionsMail,
  },
  props: {
    user: { type: Object, default: () => ({ group: {} }) },
    loading: { type: Boolean, default: false },
    activate: { type: Function, default: () => {}},
    deactivate: { type: Function, default: () => {}},
    resetPassword: { type: Function, default: () => {}},
    sendPassword: { type: Function, default: () => {}},
    resendPassword: { type: Function, default: () => {}},
  },
  data() {
    return {
      actionsIcon: 'more_horiz',
    }
  },
  computed: {
    actionDisplay() {
      return userStatusHelpers.getStatusActions(this.user.status);
    },
    activationActionLabel() {
      return this.actionDisplay.activate ? 'global.enable' : 'global.disable';
    },
    passwordActionLabel() {
      if (this.actionDisplay.resetPassword ) {
        return 'users.passwordTooltip.reset';
      }
      if (this.actionDisplay.sendPassword) {
        return 'users.passwordTooltip.send';
      }
      return 'users.passwordTooltip.resend';
    },
  },
};
</script>

<template>
  <v-menu offset-y>
    <template v-slot:activator="{ on }">
      <v-btn
        color="primary"
        dark
        icon
        v-on="on"
      >
        <v-icon>{{ actionsIcon }}</v-icon>
      </v-btn>
    </template>
    <v-list>
      <v-list-item>
        <v-list-item-avatar>
          <bs-users-table-actions-activation
            :user="user"
            :loading="loading"
            @activate="activate"
            @deactivate="deactivate"
          />
        </v-list-item-avatar>
        <v-list-item-title>
          {{ $t(activationActionLabel) }}
        </v-list-item-title>
      </v-list-item>
      <v-list-item v-if="!actionDisplay.activate">
        <v-list-item-avatar>
          <bs-user-table-actions-mail
            v-if="user.status !== 'saml-authentication'"
            :user="user"
            :loading="loading"
            @resetPassword="resetPassword"
            @sendPassword="sendPassword"
            @resendPassword="resendPassword"
          />
        </v-list-item-avatar>
        <v-list-item-title>
          {{ $t(passwordActionLabel) }}
        </v-list-item-title>
      </v-list-item>
      <v-list-item>
        <v-list-item-avatar>
          <nuxt-link :to="`/users/${user.id}`">
            <v-btn
              color="primary"
              icon
            >
              <v-icon>edit</v-icon>
            </v-btn>
          </nuxt-link>
        </v-list-item-avatar>
        <v-list-item-title>
          {{ $t('global.edit') }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<style lang="scss" scoped></style>

<i18n>
{
"en": {},
"fr": {}
}
</i18n>
