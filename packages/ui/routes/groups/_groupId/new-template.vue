<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupMenu from '~/components/group/menu.vue';
import BsTemplateCreateForm from '~/components/templates/create-form.vue';

export default {
  name: 'BsPageGroupNewTemplate',
  components: { BsGroupMenu, BsTemplateCreateForm },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
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
      newTemplate: { name: '', description: '' },
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
      )} ${this.group.name} - ${this.$t('global.newTemplate')}`;
    },
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createTemplate() {
      const { $axios } = this;
      try {
        this.loading = true;
        const template = await $axios.$post(apiRoutes.templates(), {
          ...this.newTemplate,
          groupId: this.group.id,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push(apiRoutes.templatesItem({ templateId: template.id }));
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
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-menu />
    </template>
    <bs-template-create-form
      v-model="newTemplate"
      :disabled="loading"
      @submit="createTemplate"
    />
  </bs-layout-left-menu>
</template>
