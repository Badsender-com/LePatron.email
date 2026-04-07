<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupProfilesTab from '~/components/group/profile-tab.vue';

export default {
  name: 'BsPageSettingsProfiles',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsGroupProfilesTab,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return { group: groupResponse };
    } catch (error) {
      console.error(error);
      return { group: {} };
    }
  },
  data() {
    return {
      group: {},
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    newProfileHref() {
      return `/groups/${this.$route.params.groupId}/new-profile`;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$tc('global.profile', 2)"
        :group-name="group.name"
      >
        <template #actions>
          <v-btn color="accent" elevation="0" nuxt :to="newProfileHref">
            <v-icon left> mdi-plus </v-icon>
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <bs-group-profiles-tab ref="profilesTab" />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
