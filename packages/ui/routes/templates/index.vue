<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTemplatesTable from '~/components/templates/table.vue';

export default {
  name: 'PageTemplates',
  components: { BsTemplatesTable },
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
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <bs-templates-table :templates="templates" />
      </v-col>
    </v-row>
  </v-container>
</template>
