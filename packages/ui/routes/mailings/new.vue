<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import mixinCreateMailing from '~/helpers/mixin-create-mailing.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTemplateCard from '~/components/template/card.vue';

export default {
  name: `page-mailings-new`,
  mixins: [mixinPageTitle, mixinCreateMailing],
  meta: {
    acl: acls.ACL_USER,
  },
  components: { BsTemplateCard },
  head() {
    return { title: this.title };
  },
  data() {
    return {
      templates: [],
      loading: true,
    };
  },
  computed: {
    title() {
      return `templates`;
    },
    safeTemplates() {
      return this.templates.filter((template) => template.hasMarkup);
    },
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
};
</script>

<template>
  <v-container fluid>
    <p class="text-center display-1">{{ $t(`mailings.creationNotice`) }}</p>
    <div class="page-mailings-new__templates">
      <bs-template-card
        v-for="template in safeTemplates"
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
