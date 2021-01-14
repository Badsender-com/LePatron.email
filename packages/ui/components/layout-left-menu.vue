<script>
export default {
  name: `bs-layout-left-menu`,
};
</script>

<template>
  <v-container fluid class="pa-0 fill-height">
    <v-row no-gutters class="fill-height">
      <v-col cols="2">
        <v-navigation-drawer permanent>
          <slot name="menu" />
        </v-navigation-drawer>
      </v-col>
      <v-col cols="10">
        <v-container fluid>
          <slot />
        </v-container>
      </v-col>
    </v-row>
  </v-container>
</template>
