<script>
import BsProfilesTable from '~/components/profiles/table.vue';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const profilesData = [
  {
    id: 0,
    name: 'Profil 1',
    type: 'actity',
    createdAt: '16/06/2021',
  },
  {
    id: 2,
    name: 'Profil 2',
    type: 'sendingblue',
    createdAt: '14/06/2021',
  },
  {
    id: 3,
    name: 'Profil 3',
    type: 'sendingblue',
    createdAt: '10/06/2021',
  },
];
export default {
  name: 'BsGroupProfilesTab',
  components: {
    BsProfilesTable,
  },
  data() {
    return { profiles: [], loading: false };
  },
  async mounted() {
    this.loading = true;
    await timeout(1000);
    this.profiles = profilesData;
    this.loading = false;
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <bs-profiles-table :profiles="profiles" :loading="loading" />
    </v-card-text>
  </v-card>
</template>
