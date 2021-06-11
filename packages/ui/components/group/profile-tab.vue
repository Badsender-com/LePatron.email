<script>
export default {
  name: 'BsGroupProfilesTab',
  data() {
    return { profiles: [], loading: false, hiddenCols: ['group'] };
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text> Profile listing </v-card-text>
  </v-card>
</template>
