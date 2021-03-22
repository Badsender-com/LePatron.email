<script>
import BsMailingsActionsDropdownItem from './mailings-actions-dropdown-item';

const ACTIONS_DETAILS = {
  actionRename: {
    text: 'tableHeaders.mailings.rename',
    icon: 'settings',
    emit: 'rename-action',
  },
  actionTransfer: {
    text: 'tableHeaders.mailings.transfer',
    icon: 'settings',
    emit: 'transfer-action',
  },
  actionDelete: {
    text: 'global.delete',
    icon: 'settings',
    emit: 'delete-action',
  },
  actionCopyMail: {
    text: 'global.copyMail',
    icon: 'settings',
    emit: 'copy-mail-action',
  },
};
export default {
  name: 'BsMailingsActionsDropdown',
  components: {
    BsMailingsActionsDropdownItem,
  },
  props: {
    actions: { type: Array, default: () => [] },
    mailInformation: { type: Object, default: () => {} },
  },
  computed: {
    actionsDetails() {
      return this.actions.map((action) => ({
        name: this.$t(ACTIONS_DETAILS[action].text),
        icon: ACTIONS_DETAILS[action].icon,
        emit: ACTIONS_DETAILS[action].emit,
      }));
    },
  },
  mounted() {
    console.log({ actions: this.actions });
  },
  methods: {
    handleDropDownAction(emit) {
      this.$emit(emit, this.mailInformation);
      console.log({ emit: emit || 'item not found' });
      console.log({ mailInformation: this.mailInformation });
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

<style lang="scss" scoped></style>

<i18n>
{
"en": {},
"fr": {}
}
</i18n>
