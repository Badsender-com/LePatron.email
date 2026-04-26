<script>
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupTemplatesTab from '~/components/group/templates-tab.vue';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsTemplates',
  components: {
    BsGroupSettingsPageHeader,
    BsGroupTemplatesTab,
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
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    goToNewTemplate() {
      this.$router.push(`/groups/${this.groupId}/new-template`);
    },
  },
};
</script>

<template>
  <v-container fluid>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$tc('global.template', 2)"
        :group-name="group.name"
      >
        <template #actions>
          <v-btn color="accent" elevation="0" @click="goToNewTemplate">
            <lucide-plus :size="18" class="mr-2" />
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <bs-group-templates-tab ref="templatesTab" />
    </div>
  </v-container>
</template>
