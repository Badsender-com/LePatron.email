<script>
import { mapGetters, mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupMenu from '~/components/group/menu.vue';
import BsGroupForm from '~/components/group/form.vue';
import BsGroupTemplatesTab from '~/components/group/templates-tab.vue';
import BsGroupMailingsTab from '~/components/group/mailings-tab.vue';
import BsGroupUsersTab from '~/components/group/users-tab.vue';
import BsGroupWorkspacesTab from '~/components/group/workspaces-tab.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
import { PAGE_NAMES } from '~/helpers/constants/page-names.js';

export default {
  name: 'BsPageGroup',
  components: {
    BsGroupMenu,
    BsGroupForm,
    BsGroupUsersTab,
    BsGroupTemplatesTab,
    BsGroupMailingsTab,
    BsGroupWorkspacesTab,
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
      fromCreateOrUpdate: false
    };
  },
  head() {
    return { title: this.title };
  },
  beforeRouteEnter(to, from, next) {
    next(page => {
      if (from.name === PAGE_NAMES.WORKSPACE_CREATE || from.name === PAGE_NAMES.WORKSPACE_UPDATE ) {
        page.fromCreateOrUpdate = true;
      }
    })
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    tab() {
      return this.fromCreateOrUpdate ? 'group-workspaces' : 'group-templates';
    },
    title() {
      return `${this.$tc('global.group', 1)} – ${this.group.name}`;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        this.loading = true;
        this.group = await $axios.$put(
          apiRoutes.groupsItem(params),
          this.group
        );
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
    <v-tabs :value="tab" centered>
      <v-tabs-slider color="accent" />
      <v-tab href="#group-informations">
        {{ $t('groups.tabs.informations') }}
      </v-tab>
      <v-tab v-if="isAdmin" href="#group-templates">
        {{ $tc('global.template', 2) }}
      </v-tab>
      <v-tab v-if="isAdmin" href="#group-mailings">
        {{ $tc('global.mailing', 2) }}
      </v-tab>
      <v-tab v-if="isGroupAdmin" href="#group-workspaces">
        {{ $tc('global.teams', 2) }}
      </v-tab>
      <v-tab href="#group-users">
        {{ $tc('global.user', 2) }}
      </v-tab>
      <v-tab-item value="group-informations" eager>
        <bs-group-form
          v-model="group"
          flat
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
    </v-tabs>
  </bs-layout-left-menu>
</template>
