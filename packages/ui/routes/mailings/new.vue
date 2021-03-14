<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import mixinCreateMailing from '~/helpers/mixin-create-mailing.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import TemplateCard from '~/routes/mailings/__partials/template-card';

export default {
  name: 'PageMailingsNew',
  components: { TemplateCard },
  mixins: [mixinPageTitle, mixinCreateMailing],
  meta: {
    acl: acls.ACL_USER,
  },
  async asyncData(nuxtContext) {
    const { $axios } = nuxtContext;
    try {
      const { items } = await $axios.$get(apiRoutes.templates());
      return {
        templates: items.filter((template) => template.hasMarkup),
        templatesIsLoading: false,
      };
    } catch (error) {
      return { templatesIsError: true, templatesIsLoading: false };
    }
  },
  data() {
    return {
      templates: [],
      templatesIsLoading: true,
      templatesIsError: false,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return 'Templates';
    },
  },
};
</script>

<template>
  <v-container fluid>
    <p class="text-center display-1">
      {{ $t(`mailings.creationNotice`) }}
    </p>
    <div class="page-mailings-new__templates">
      <template-card
        v-for="template in templates"
        :key="template.id"
        :template="template"
        @click="mixinCreateMailing"
      />
    </div>
  </v-container>
</template>

<style lang="scss" scoped>
.page-mailings-new__templates {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minMax(0, 1fr));
  grid-gap: 1rem;
}
</style>
