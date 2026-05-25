<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getEmailsGroups } from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import FormEmailsGroup from '~/components/group/form-emails-group';
import BsPageHeader from '~/components/layout/bs-page-header.vue';

const errors = {
  409: 'global.errors.emailsGroupExist',
};

export default {
  name: 'BsPageNewEmailsGroup',
  components: { FormEmailsGroup, BsPageHeader },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;

    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return {
        isLoading: false,
        group: groupResponse,
      };
    } catch (error) {
      return { isLoading: false, isError: true };
    }
  },
  data() {
    return {
      group: {},
      loading: false,
      emailsGroup: {
        emails: '',
        name: '',
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
    async createUser(data) {
      const { $axios } = this;
      try {
        this.loading = true;
        await $axios.$post(getEmailsGroups(), {
          ...data,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push({
          path: `/groups/${this.groupId}`,
          query: { redirectTab: 'emails-groups' },
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t(
            errors[error.statusCode] || 'global.errors.errorOccured'
          ),
          color: 'error',
        });
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('[new-emails-group] submit failed', error);
        }
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
        {{ $t('global.newEmailsGroup') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <form-emails-group
        v-model="emailsGroup"
        :loading="loading"
        @submit="createUser"
      />
    </v-container>
  </div>
</template>
