<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsTemplateForm from '~/components/template/form.vue';

export default {
  name: 'BsPageGroupNewTemplate',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsTemplateForm,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return {
        group: groupResponse,
        isLoading: false,
        template: {
          name: '',
          description: '',
          groupId: params.groupId,
        },
      };
    } catch (error) {
      console.error(error);
      return {
        group: {},
        isLoading: false,
        template: {
          name: '',
          description: '',
          groupId: params.groupId,
        },
      };
    }
  },
  data() {
    return {
      group: {},
      isLoading: false,
      template: {
        name: '',
        description: '',
        groupId: '',
      },
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async createTemplate(formData) {
      try {
        this.isLoading = true;
        // Extract data from FormData and send as JSON
        // Files will be uploaded after redirect to edit page
        const payload = {
          name: formData.get('name'),
          description: formData.get('description') || '',
          groupId: this.group.id,
        };
        const template = await this.$axios.$post(
          apiRoutes.templates(),
          payload
        );
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        // Redirect to edit page where user can upload files
        this.$router.push(`/templates/${template.id}`);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.error(error);
      } finally {
        this.isLoading = false;
      }
    },

    onCancel() {
      this.$router.push(`/groups/${this.groupId}/settings/templates`);
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$t('templates.newTemplate')"
        :group-name="group.name"
      />
      <bs-template-form
        :template="template"
        :groups="[group]"
        :is-edit-mode="false"
        :hide-group-select="true"
        :disabled="isLoading"
        @submit="createTemplate"
        @cancel="onCancel"
      />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
