<script>
export default {
  name: 'ProfilesActionsDropdown',
};
</script>

<template>
  <v-menu offset-y>
    <template #activator="{ on }">
      <v-btn color="accent" dark icon v-on="on">
        <v-icon>mdi-dots-vertical</v-icon>
      </v-btn>
    </template>
    <v-list activable>
      <slot />
    </v-list>
  </v-menu>
</template>
