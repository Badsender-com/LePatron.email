<script>
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupWorkspacesTab from '~/components/group/workspaces-tab.vue';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsWorkspaces',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsGroupWorkspacesTab,
    LucidePlus: Plus,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return {
        group: groupResponse,
      };
    } catch (error) {
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
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    goToNewWorkspace() {
      this.$router.push(`/groups/${this.groupId}/new-workspace`);
    },
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
        :title="$tc('global.teams', 2)"
        :group-name="group.name"
      >
        <template #actions>
          <v-btn color="accent" elevation="0" @click="goToNewWorkspace">
            <lucide-plus :size="20" class="mr-2" />
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <bs-group-workspaces-tab ref="workspacesTab" />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
