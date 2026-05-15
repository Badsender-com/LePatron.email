<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsUserForm from '~/components/users/form.vue';
import BsPageHeader from '~/components/layout/bs-page-header.vue';

export default {
  name: 'BsPageGroupNewUser',
  components: { BsUserForm, BsPageHeader },
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
      console.log(error);
    }
  },
  data() {
    return {
      group: {},
      loading: false,
      newUser: {
        email: '',
        name: '',
        externalUsername: '',
        lang: 'fr',
        role: 'regular_user',
      },
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    groupId() {
      return this.$route.params.groupId;
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createUser() {
      const { $axios } = this;
      try {
        this.loading = true;
        const user = await $axios.$post(apiRoutes.users(), {
          groupId: this.groupId,
          ...this.newUser,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push(`/groups/${this.groupId}/settings/users/${user.id}`);
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('global.newUser') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <bs-user-form v-model="newUser" :loading="loading" @submit="createUser" />
    </v-container>
  </div>
</template>
