<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import AssetForm from '~/components/assets/asset-form.vue';
import BsGroupMenu from '~/components/group/menu.vue';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { groupAssets } from '~/helpers/api-routes';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'PageNewAsset',
  components: { AssetForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
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
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return `${this.$tc('global.settings', 1)} : ${this.$tc(
        'global.group',
        1
      )} ${this.group.name} - ${this.$t('assets.newAsset')}`;
    },
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createAsset(data) {
      try {
        this.loading = true;
        await this.$axios.$post(groupAssets({ groupId: this.groupId }), data);
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push(`/groups/${this.groupId}?redirectTab=group-assets`);
      } catch (error) {
        const errorCode = error?.response?.data?.message;
        if (errorCode === 'ASSET_NAME_EXISTS') {
          this.showSnackbar({
            text: this.$t('global.errors.errorOccured'),
            color: 'error',
          });
        } else {
          this.showSnackbar({
            text: this.$t('global.errors.errorOccured'),
            color: 'error',
          });
        }
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
    <asset-form
      :title="$t('assets.newAsset')"
      :loading="loading"
      @submit="createAsset"
    />
  </bs-layout-left-menu>
</template>
