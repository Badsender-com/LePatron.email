<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import AssetForm from '~/components/assets/asset-form.vue';
import BsGroupMenu from '~/components/group/menu.vue';
import { groupAssetItem } from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'PageEditAsset',
  components: { AssetForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const response = await $axios.$get(
        groupAssetItem({ groupId: params.groupId, assetId: params.assetId })
      );
      return {
        asset: response.result || response,
      };
    } catch (error) {
      console.log(error);
      return { asset: {}, isError: true };
    }
  },
  data() {
    return {
      asset: {},
      loading: false,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$t('assets.editAsset', { name: this.asset.name || '' });
    },
    groupId() {
      return this.$route.params.groupId;
    },
    assetId() {
      return this.$route.params.assetId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateAsset(data) {
      try {
        this.loading = true;
        await this.$axios.$put(
          groupAssetItem({ groupId: this.groupId, assetId: this.assetId }),
          data
        );
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
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
      :title="$t('assets.editAsset', { name: asset.name })"
      :asset="asset"
      :loading="loading"
      @submit="updateAsset"
    />
  </bs-layout-left-menu>
</template>
