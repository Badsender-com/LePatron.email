<script>
import BsProfilesTable from '~/components/profiles/table.vue';
import { getProfileId, groupsProfiles } from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'BsGroupProfilesTab',
  components: {
    BsProfilesTable,
  },
  data() {
    return { profiles: [], loading: false, groupId: null };
  },
  async mounted() {
    await this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async fetchData() {
      const {
        $axios,
        $route: { params },
      } = this;
      this.groupId = params.groupId;
      this.loading = true;
      const { items } = await $axios.$get(groupsProfiles(params));
      this.profiles = items;
      this.loading = false;
    },
    async handleDelete(profile) {
      try {
        await this.$axios.delete(getProfileId(profile?.id));
        await this.fetchData();
        this.showSnackbar({
          text: this.$t('groups.workspaceTab.deleteSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <bs-profiles-table
        :profiles="profiles"
        :group-id="groupId"
        :loading="loading"
        @delete="handleDelete"
      />
    </v-card-text>
  </v-card>
</template>
