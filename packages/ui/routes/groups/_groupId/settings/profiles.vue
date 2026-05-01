<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupProfilesTab from '~/components/group/profile-tab.vue';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsProfiles',
  components: {
    BsGroupSettingsPageHeader,
    BsGroupProfilesTab,
    LucidePlus: Plus,
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
  <v-container fluid>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$tc('global.profile', 2)"
        :group-name="group.name"
      >
        <template #actions>
          <v-btn color="accent" elevation="0" nuxt :to="newProfileHref">
            <lucide-plus :size="18" class="mr-2" />
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <bs-group-profiles-tab ref="profilesTab" />
    </div>
  </v-container>
</template>
