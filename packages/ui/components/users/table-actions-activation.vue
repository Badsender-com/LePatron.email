<script>
import * as userStatusHelpers from '~/helpers/user-status.js';

export default {
  name: `bs-users-table-actions-activation`,
  props: {
    user: { type: Object, default: () => ({ group: {} }) },
    loading: { type: Boolean, default: false },
  },
  computed: {
    actionDisplay() {
      console.log({ user: this.user })
      return userStatusHelpers.getStatusActions(this.user.status);
    },
    actionIcon() {
      return this.actionDisplay.activate
        ? `accessibility`
        : `airline_seat_individual_suite`;
    },
  },
  methods: {
    toggleUser() {
      if (this.actionDisplay.activate) return this.$emit(`activate`, this.user);
      this.$emit(`deactivate`, this.user);
    },
  },
};
</script>

<template>
  <v-btn @click="toggleUser" :disabled="loading" icon color="primary">
    <v-icon>{{ actionIcon }}</v-icon>
  </v-btn>
</template>

<style lang="scss" scoped></style>

<i18n>
{
  "en": {},
  "fr": {}
}
</i18n>
