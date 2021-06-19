<script>
import BsProfilesTable from '~/components/profiles/table.vue';
import { getProfiles } from '~/helpers/api-routes';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'BsGroupProfilesTab',
  components: {
    BsProfilesTable,
  },
  data() {
    return { profiles: [], loading: false };
  },
  async mounted() {
    const { $axios } = this;
    this.loading = true;
    const { items } = await $axios.$get(getProfiles());
    this.profiles = items;
    this.loading = false;
  },
  methods: {
    async handleDelete(profile) {
      this.loading = true;
      await timeout(1000);
      // after the success of the delete action remove the deleted profile from the list
      this.profiles = this.profiles.filter(
        (profileElement) => profileElement.id !== profile.id
      );
      this.loading = false;
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <bs-profiles-table
        :profiles="profiles"
        :loading="loading"
        @delete="handleDelete"
      />
    </v-card-text>
  </v-card>
</template>
