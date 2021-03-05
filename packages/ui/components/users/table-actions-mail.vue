<script>
import * as userStatusHelpers from '~/helpers/user-status.js';

export default {
  name: 'BsUsersTableActionsMail',
  props: {
    user: { type: Object, default: () => ({ group: {} }) },
    loading: { type: Boolean, default: false },
  },
  computed: {
    actionDisplay() {
      return userStatusHelpers.getStatusActions(this.user.status);
    },
    actionText() {
      const { actionDisplay } = this;
      if (actionDisplay.activate) return '';
      if (actionDisplay.resetPassword)
        return `${this.$t('users.actions.reset')}`;
      if (actionDisplay.sendPassword) return `${this.$t('users.actions.send')}`;
      if (actionDisplay.reSendPassword)
        return `${this.$t('users.actions.resend')}`;
      return '';
    },
    passwordActionLabel() {
      if (this.actionDisplay.resetPassword) {
        return 'users.passwordTooltip.reset';
      }
      if (this.actionDisplay.sendPassword) {
        return 'users.passwordTooltip.send';
      }
      return 'users.passwordTooltip.resend';
    },
  },
  methods: {
    mailAction() {
      const { actionDisplay } = this;
      if (actionDisplay.activate) return '';
      if (actionDisplay.resetPassword) {
        return this.$emit('resetPassword', this.user);
      }
      if (actionDisplay.sendPassword) {
        return this.$emit('sendPassword', this.user);
      }
      if (actionDisplay.reSendPassword) {
        return this.$emit('resendPassword', this.user);
      }
    },
  },
};
</script>

<template>
  <v-list-item
    v-if="!actionDisplay.activate"
    link
    @click="mailAction"
  >
    <v-list-item-avatar>
      <v-btn
        v-if="!actionDisplay.activate"
        class="bs-users-table-actions-mail"
        :disabled="loading"
        text
        small
        color="primary"
      >
        <v-icon>send</v-icon>
      </v-btn>
    </v-list-item-avatar>
    <v-list-item-title>
      {{ $t(passwordActionLabel) }}
    </v-list-item-title>
  </v-list-item>

</template>

<style lang="scss" scoped></style>

<i18n>
{
  "en": {},
  "fr": {}
}
</i18n>
