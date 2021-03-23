<script>
import BsMailingsActionsDropdownItem from './mailings-actions-dropdown-item';
import { ACTIONS_DETAILS } from '~/ui/constants/mail';

export default {
  name: 'BsMailingsActionsDropdown',
  components: {
    BsMailingsActionsDropdownItem,
  },
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
      <bs-mailings-actions-dropdown-item
        v-for="action in actionsDetails"
        :key="action.name"
        :name="action.name"
        :icon="action.icon"
        :on-click="() => handleDropDownAction(action.emit)"
      />
    </v-list>
  </v-menu>
</template>
