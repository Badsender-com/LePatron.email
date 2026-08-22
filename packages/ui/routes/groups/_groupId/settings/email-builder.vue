<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupEmailBuilderTab from '~/components/group/email-builder-tab.vue';
import { IS_ADMIN, USER, GROUP, USER_SET } from '~/store/user';

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
      sessionGroup: GROUP,
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

      // The sidebar decides whether to list "Typologies" from the company held in
      // the session, not from this page's copy. Without this, a company admin
      // flips the switch, sees the confirmation, and the entry only appears after
      // a full page reload. Only when the company edited is the caller's own — a
      // super admin editing someone else's company must keep their own session.
      const sessionGroupId =
        this.sessionGroup && (this.sessionGroup.id || this.sessionGroup._id);
      if (sessionGroupId && String(sessionGroupId) === String(group.id)) {
        await this.$store.dispatch(
          `${USER}/${USER_SET}`,
          this.$store.state.user.info
        );
      }
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
