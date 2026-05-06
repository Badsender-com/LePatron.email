<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import BsTemplateForm from '~/components/template/form.vue';

export default {
  name: 'BsPageGroupNewTemplate',
  components: {
    BsPageHeader,
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
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    groupId() {
      return this.$route.params.groupId;
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('templates.newTemplate') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <bs-template-form
        :template="template"
        :groups="[group]"
        :is-edit-mode="false"
        :hide-group-select="true"
        :disabled="isLoading"
        @submit="createTemplate"
        @cancel="onCancel"
      />
    </v-container>
  </div>
</template>
