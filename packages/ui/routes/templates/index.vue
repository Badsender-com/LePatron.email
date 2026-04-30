<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTemplatesTable from '~/components/templates/table.vue';
import BsCompaniesNav from '~/components/group/companies-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';

export default {
  name: 'PageTemplates',
  components: { BsTemplatesTable, BsCompaniesNav, BsGroupSettingsPageHeader },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios } = nuxtContext;
    try {
      const templatesResponse = await $axios.$get(apiRoutes.templates());
      return { templates: templatesResponse.items };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return { templates: [] };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$tc('global.template', 2);
    },
  },
  methods: {
    deleteItem(item) {
      console.log(item);
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-companies-nav />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header :title="$tc('global.template', 2)" />
      <bs-templates-table :templates="templates" />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
