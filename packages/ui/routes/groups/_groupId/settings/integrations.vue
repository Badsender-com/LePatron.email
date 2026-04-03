<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupIntegrationsTab from '~/components/group/integrations-tab.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsIntegrations',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsGroupIntegrationsTab,
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
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
  },
  methods: {
    openCreateForm() {
      this.$refs.integrationsTab.openCreateForm();
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
      <bs-group-settings-page-header :title="$t('integrations.title')" :group-name="group.name">
        <template #actions>
          <v-btn color="accent" elevation="0" @click="openCreateForm">
            <lucide-plus :size="18" class="mr-2" />
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <bs-group-integrations-tab ref="integrationsTab" />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
