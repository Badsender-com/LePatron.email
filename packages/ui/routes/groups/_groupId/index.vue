<script>
import { mapGetters, mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupMenu from '~/components/group/menu.vue';
import BsGroupForm from '~/components/group/form.vue';
import BsGroupTemplatesTab from '~/components/group/templates-tab.vue';
import BsGroupMailingsTab from '~/components/group/mailings-tab.vue';
import BsGroupUsersTab from '~/components/group/users-tab.vue';
import BsGroupWorkspacesTab from '~/components/group/workspaces-tab.vue';
import BsEmailsGroupsTab from '~/components/group/emails-groups-tab.vue';
import BsGroupProfilesTab from '~/components/group/profile-tab.vue';
import GroupPersonalizedVariableTab from '~/components/group/group-personalized-variable-tab';
import BsGroupLoading from '~/components/loadingBar';

import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageGroup',
  components: {
    BsGroupMenu,
    BsGroupForm,
    BsGroupUsersTab,
    BsGroupTemplatesTab,
    BsGroupMailingsTab,
    BsGroupWorkspacesTab,
    BsGroupLoading,
    BsGroupProfilesTab,
    BsEmailsGroupsTab,
    GroupPersonalizedVariableTab,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return { group: groupResponse };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      group: {},
      loading: false,
      intersectionObserver: null,
      activeTab: 'informations',
    };
  },
  head() {
    return { title: this.title };
  },

  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    title() {
      return `${this.$tc('global.settings', 1)} : ${this.$tc(
        'global.group',
        1
      )} ${this.group.name}`;
    },
  },

  watch: {
    activeTab(newTab) {
      // Replace the URL without causing a navigation or reload
      this.$router.replace({
        query: { ...this.$route.query, redirectTab: newTab },
      });
    },
  },
  created() {
    if (this.$route.query.redirectTab) {
      this.activeTab = this.$route.query.redirectTab;
    }
  },
  mounted() {
    this.observeVisibility();
  },
  beforeDestroy: function () {
    this.unObserveVisibility();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    observeVisibility() {
      const element = this.$refs.tabs?.$el;
      if (window.IntersectionObserver && element) {
        this.intersectionObserver = new IntersectionObserver(
          (entries) => {
            if (entries[0].intersectionRatio) {
              // There is an intersection, the content is visible
              // Manually calling VTabs onResize method to properly show the slider
              this.$refs.tabs.onResize();
            }
          },
          {
            root: document.body,
          }
        );
        this.intersectionObserver?.observe(element);
      }
    },
    unObserveVisibility() {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
    },
    async updateGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        this.loading = true;
        const payload = this.isGroupAdmin
          ? { name: this.group.name, colorScheme: this.group.colorScheme }
          : this.group;
        await $axios.$put(apiRoutes.groupsItem(params), payload);
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
        this.mixinPageTitleUpdateTitle(this.title);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-menu />
    </template>
    <client-only>
      <v-tabs ref="tabs" :value="activeTab" centered>
        <v-tabs-slider color="accent" />
        <v-tab
          href="#group-informations"
          @click="activeTab = 'group-informations'"
        >
          {{ $t('groups.tabs.informations') }}
        </v-tab>
        <v-tab
          v-if="isAdmin"
          href="#group-templates"
          @click="activeTab = 'group-templates'"
        >
          {{ $tc('global.template', 2) }}
        </v-tab>
        <v-tab
          v-if="isGroupAdmin"
          href="#group-workspaces"
          @click="activeTab = 'group-workspaces'"
        >
          {{ $tc('global.teams', 2) }}
        </v-tab>
        <v-tab href="#group-users" @click="activeTab = 'group-users'">
          {{ $tc('global.user', 2) }}
        </v-tab>
        <v-tab
          v-if="isAdmin"
          href="#group-mailings"
          @click="activeTab = 'group-mailings'"
        >
          {{ $tc('global.mailing', 2) }}
        </v-tab>
        <v-tab
          v-if="isAdmin"
          href="#group-profile"
          @click="activeTab = 'group-profile'"
        >
          {{ $tc('global.profile', 2) }}
        </v-tab>
        <v-tab
          v-if="isGroupAdmin"
          href="#group-emails-groups"
          @click="activeTab = 'group-emails-groups'"
        >
          {{ $tc('global.emailsGroups', 2) }}
        </v-tab>
        <v-tab
          v-if="isGroupAdmin"
          href="#group-personalized-variables"
          @click="activeTab = 'group-personalized-variables'"
        >
          {{ $t('global.personalizedVariables') }}
        </v-tab>
        <v-tab-item value="group-informations">
          <bs-group-form
            v-model="group"
            :is-edit="true"
            elevation="0"
            :disabled="loading"
            @submit="updateGroup"
          />
        </v-tab-item>
        <v-tab-item v-if="isAdmin" value="group-templates">
          <bs-group-templates-tab />
        </v-tab-item>
        <v-tab-item v-if="isAdmin" value="group-mailings">
          <bs-group-mailings-tab />
        </v-tab-item>
        <v-tab-item v-if="isGroupAdmin" value="group-workspaces">
          <bs-group-workspaces-tab />
        </v-tab-item>
        <v-tab-item value="group-users">
          <bs-group-users-tab />
        </v-tab-item>
        <v-tab-item v-if="isAdmin" value="group-profile">
          <bs-group-profiles-tab />
        </v-tab-item>
        <v-tab-item v-if="isGroupAdmin" value="group-emails-groups">
          <bs-emails-groups-tab />
        </v-tab-item>
        <v-tab-item v-if="isGroupAdmin" value="group-personalized-variables">
          <group-personalized-variable-tab />
        </v-tab-item>
      </v-tabs>
      <bs-group-loading slot="placeholder" />
    </client-only>
  </bs-layout-left-menu>
</template>
