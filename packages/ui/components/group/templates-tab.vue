<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTemplatesTable from '~/components/templates/table.vue';

export default {
  name: 'BsGroupTemplatesTab',
  components: { BsTemplatesTable },
  data() {
    return { templates: [], loading: false };
  },
  async mounted() {
    const {
      $axios,
      $route: { params },
    } = this;
    try {
      this.loading = true;
      const templatesResponse = await $axios.$get(
        apiRoutes.groupsItemTemplates(params)
      );
      this.templates = templatesResponse.items;
    } catch (error) {
      console.log(error);
    } finally {
      this.loading = false;
    }
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <bs-templates-table
        :templates="templates"
        :loading="loading"
        :hidden-cols="[`group`]"
      />
    </v-card-text>
  </v-card>
</template>
