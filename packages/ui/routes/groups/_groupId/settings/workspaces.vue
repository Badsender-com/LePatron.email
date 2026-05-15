<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupWorkspacesTab from '~/components/group/workspaces-tab.vue';
import { Plus } from 'lucide-vue';
import { IS_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsWorkspaces',
  components: {
    BsPageHeader,
    BsGroupWorkspacesTab,
    LucidePlus: Plus,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    return safeFetchGroup(nuxtContext);
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
    }),
    groupId() {
      return this.$route.params.groupId;
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $tc('global.teams', 2) }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
      <template #actions>
        <v-btn color="accent" elevation="0" @click="goToNewWorkspace">
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('global.add') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-group-workspaces-tab ref="workspacesTab" />
      </div>
    </v-container>
  </div>
</template>
