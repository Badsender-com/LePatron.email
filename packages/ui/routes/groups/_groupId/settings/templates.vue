<script>
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupTemplatesTab from '~/components/group/templates-tab.vue';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsTemplates',
  components: {
    BsPageHeader,
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
    showGroupBadge() {
      return this.group.name;
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $tc('global.template', 2) }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
      <template #actions>
        <v-btn color="accent" elevation="0" @click="goToNewTemplate">
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('global.add') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-group-templates-tab ref="templatesTab" />
      </div>
    </v-container>
  </div>
</template>
