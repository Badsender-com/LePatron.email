<script>
import BsMailingsActionsDropdownItem from './mailings-actions-dropdown-item';

const ACTIONS_DETAILS = {
  actionRename: {
    text: 'tableHeaders.mailings.rename',
    icon: 'settings',
  },
  actionTransfer: {
    text: 'tableHeaders.mailings.transfer',
    icon: 'settings',
  },
  actionDelete: {
    text: 'global.delete',
    icon: 'settings',
  },
  actionCopyMail: {
    text: 'global.copyMail',
    icon: 'settings',
  },
};
export default {
  name: 'BsMailingsActionsDropdown',
  components: {
    BsMailingsActionsDropdownItem,
  },
  props: {
    actions: { type: Array, default: () => [] },
  },
  computed: {
    actionsDetails() {
      return this.actions.map((action) => ({
        name: this.$t(ACTIONS_DETAILS[action].text),
        icon: ACTIONS_DETAILS[action].icon,
      }));
    },
  },
  mounted() {
    console.log({ actions: this.actions });
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
      />
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
