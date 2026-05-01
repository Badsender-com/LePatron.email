<script>
export default {
  name: 'BsLayoutLeftMenu',
};
</script>

<template>
  <v-container fluid class="pa-0 fill-height">
    <v-row no-gutters class="fill-height">
      <v-col cols="3" class="navigation-drawer-container">
        <slot name="menu" />
      </v-col>
      <v-col cols="9">
        <v-container fluid>
          <slot />
        </v-container>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.navigation-drawer-container {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  min-height: calc(100vh - 4rem);
}
</style>
