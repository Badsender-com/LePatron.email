<script>
export default {
  name: 'BsMailingsActionsDropdown',
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
