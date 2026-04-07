<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupColorsTab from '~/components/group/colors-tab.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsColors',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsGroupColorsTab,
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
      loading: false,
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
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        this.loading = true;
        const payload =
          this.isGroupAdmin && !this.isAdmin
            ? { name: this.group.name, colorScheme: this.group.colorScheme }
            : this.group;
        const updatedGroup = await $axios.$put(
          apiRoutes.groupsItem(params),
          payload
        );
        this.group = updatedGroup;
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
      } catch (error) {
        const errorCode = error?.response?.data?.message;
        this.showSnackbar({
          text:
            errorCode && this.$te(`global.errors.${errorCode}`)
              ? this.$t(`global.errors.${errorCode}`)
              : this.$t('global.errors.errorOccured'),
          color: 'error',
        });
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
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$t('settingsNav.colors')"
        :group-name="group.name"
      />
      <bs-group-colors-tab
        v-model="group"
        :disabled="loading"
        :loading="loading"
        @save="updateGroup"
      />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
