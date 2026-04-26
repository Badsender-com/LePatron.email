<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupAiFeaturesTab from '~/components/group/ai-features-tab.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsAiFeatures',
  components: {
    BsGroupSettingsPageHeader,
    BsGroupAiFeaturesTab,
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
};
</script>

<template>
  <v-container fluid>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$t('aiFeatures.title')"
        :group-name="group.name"
      />
      <bs-group-ai-features-tab :active="true" />
    </div>
  </v-container>
</template>
