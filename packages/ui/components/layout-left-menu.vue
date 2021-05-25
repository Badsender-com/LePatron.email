<script>
export default {
  name: 'BsLayoutLeftMenu',
};
</script>

<template>
  <v-container fluid class="pa-0 fill-height">
    <v-row no-gutters class="fill-height">
      <v-col cols="2" class="navigation-drawer-container">
        <v-navigation-drawer class="fill-height" permanent>
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

<style scoped>
.v-navigation-drawer {
  width: 100% !important;
}
.navigation-drawer-container {
  max-height: calc(100vh - 4rem);
}
</style>
