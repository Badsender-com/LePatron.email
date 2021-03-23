<script>
import { ACTIONS_DETAILS } from '~/constants/mail';

export default {
  name: 'BsMailingsActionsDropdown',
  props: {
    actions: { type: Array, default: () => [] },
    mailInformation: { type: Object, default: () => {} },
  },
  data() {
    return {
      actionsDetails: this.actions.map((action) => ({
        name: this.$t(ACTIONS_DETAILS[action].text),
        icon: ACTIONS_DETAILS[action].icon,
        emit: ACTIONS_DETAILS[action].emit,
      })),
    };
  },
  methods: {
    handleDropDownAction(emit) {
      this.$emit(emit, this.mailInformation);
    },
  },
};
</script>

<template>
  <v-menu offset-y>
    <template #activator="{ on }">
      <v-btn color="primary" dark icon v-on="on">
        <v-icon>more_horiz</v-icon>
      </v-btn>
    </template>
    <v-list activable>
      <slot name="dropDownItem" />
    </v-list>
  </v-menu>
</template>
