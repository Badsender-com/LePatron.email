<script>
import * as userStatusHelpers from '~/helpers/user-status.js';

export default {
  name: 'BsUsersTableActionsActivation',
  props: {
    user: { type: Object, default: () => ({ group: {} }) },
    loading: { type: Boolean, default: false },
  },
  computed: {
    actionDisplay() {
      return userStatusHelpers.getStatusActions(this.user.status);
    },
    activationActionLabel() {
      return this.actionDisplay.activate ? 'global.enable' : 'global.disable';
    },
    actionIcon() {
      return this.actionDisplay.activate
        ? 'accessibility'
        : 'airline_seat_individual_suite';
    },
  },
  methods: {
    toggleUser() {
      if (this.actionDisplay.activate) {
        return this.$emit('activate', this.user);
      }
      this.$emit('deactivate', this.user);
    },
  },
};
</script>

<template>
  <v-list-item link @click="toggleUser">
    <v-list-item-avatar>
      <v-btn :disabled="loading" icon color="accent">
        <v-icon>{{ actionIcon }}</v-icon>
      </v-btn>
    </v-list-item-avatar>
    <v-list-item-title>
      {{ $t(activationActionLabel) }}
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
