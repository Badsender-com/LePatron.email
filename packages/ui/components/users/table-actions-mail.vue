<script>
import * as userStatusHelpers from '~/helpers/user-status.js';

export default {
  name: `bs-users-table-actions-mail`,
  props: {
    user: { type: Object, default: () => ({ group: {} }) },
    loading: { type: Boolean, default: false },
  },
  computed: {
    actionDisplay() {
      console.log({ user: this.user })
      return userStatusHelpers.getStatusActions(this.user.status);
    },
    actionText() {
      const { actionDisplay } = this;
      if (actionDisplay.activate) return ``;
      if (actionDisplay.resetPassword)
        return `${this.$t('users.actions.reset')}`;
      if (actionDisplay.sendPassword) return `${this.$t('users.actions.send')}`;
      if (actionDisplay.reSendPassword)
        return `${this.$t('users.actions.resend')}`;
    },
  },
  methods: {
    mailAction() {
      const { actionDisplay } = this;
      if (actionDisplay.activate) return ``;
      if (actionDisplay.resetPassword) {
        return this.$emit(`resetPassword`, this.user);
      }
      if (actionDisplay.sendPassword) {
        return this.$emit(`sendPassword`, this.user);
      }
      if (actionDisplay.reSendPassword) {
        return this.$emit(`resendPassword`, this.user);
      }
    },
  },
};
</script>

<template>
  <v-btn
    v-if="!actionDisplay.activate"
    class="bs-users-table-actions-mail"
    @click="mailAction"
    :disabled="loading"
    text
    small
    color="primary"
    >{{ actionText }}</v-btn
  >
</template>

<style lang="scss" scoped></style>

<i18n>
{
  "en": {},
  "fr": {}
}
</i18n>
