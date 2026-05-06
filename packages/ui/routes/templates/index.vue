<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTemplatesTable from '~/components/templates/table.vue';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';

export default {
  name: 'PageTemplates',
  components: { BsTemplatesTable, BsPageHeader },
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $tc('global.template', 2) }}
      </template>
    </bs-page-header>
    <v-container fluid>
      <bs-templates-table :templates="templates" />
    </v-container>
  </div>
</template>
