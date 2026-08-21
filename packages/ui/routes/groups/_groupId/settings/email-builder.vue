<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupEmailBuilderTab from '~/components/group/email-builder-tab.vue';
import { IS_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsEmailBuilder',
  components: {
    BsPageHeader,
    BsGroupEmailBuilderTab,
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
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    // The switch drives what the sidebar and the editor show, so the company is
    // refetched rather than patched locally.
    async refreshGroup() {
      // Same helper as asyncData, handed the pieces of context it needs so a
      // failed refetch still raises its snackbar instead of failing silently.
      const { group } = await safeFetchGroup({
        $axios: this.$axios,
        params: this.$route.params,
        store: this.$store,
        app: { i18n: this.$i18n },
      });
      this.group = group;
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
        {{ $t('emailBuilderSettings.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-group-email-builder-tab :group="group" @update="refreshGroup" />
      </div>
    </v-container>
  </div>
</template>
