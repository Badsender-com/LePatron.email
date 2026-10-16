<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupForm from '~/components/group/form.vue';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../../../shared/access/roles.js';

export default {
  name: 'BsPageSettingsGeneral',
  components: {
    BsPageHeader,
    BsGroupForm,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_GROUP_MANAGE,
  },
  async asyncData(nuxtContext) {
    return safeFetchGroup(nuxtContext);
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
    ...mapGetters(USER, { can: CAN }),
    canManagePlatform() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE);
    },
    showGroupBadge() {
      return this.canManagePlatform && this.group.name;
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
        // A company admin changes its company's name and colours only.
        const payload = this.canManagePlatform
          ? this.group
          : { name: this.group.name, colorScheme: this.group.colorScheme };
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('groups.tabs.general') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>

    <v-container fluid>
      <bs-group-form
        v-model="group"
        :is-edit="true"
        elevation="0"
        :disabled="loading"
        :loading="loading"
        @submit="updateGroup"
      />
    </v-container>
  </div>
</template>
