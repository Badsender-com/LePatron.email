<script>
import BsMailingsActionsDropdownItem from './mailings-actions-dropdown-item';

export default {
  name: 'BsMailingsActionsDropdown',
  components: {
    BsMailingsActionsDropdownItem,
  },
  props: {
    actions: { type: Array, default: () => [] },
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
      <bs-mailings-actions-dropdown-item />
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
