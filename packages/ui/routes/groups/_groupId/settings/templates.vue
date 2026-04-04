<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsGroupTemplatesTab from '~/components/group/templates-tab.vue';
import BsModalCreateTemplate from '~/components/group/modal-create-template.vue';
import { Plus } from 'lucide-vue';

export default {
  name: 'BsPageSettingsTemplates',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsGroupTemplatesTab,
    BsModalCreateTemplate,
    LucidePlus: Plus,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return { group: groupResponse };
    } catch (error) {
      console.error(error);
      return { group: {} };
    }
  },
  data() {
    return {
      group: {},
      modalLoading: false,
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    openCreateModal() {
      this.$refs.createModal.open();
    },
    async createTemplate(template) {
      try {
        this.modalLoading = true;
        const createdTemplate = await this.$axios.$post(apiRoutes.templates(), {
          ...template,
          groupId: this.group.id,
        });
        this.$refs.createModal.close();
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push(apiRoutes.templatesItem({ templateId: createdTemplate.id }));
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.modalLoading = false;
      }
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
      <bs-group-settings-page-header :title="$tc('global.template', 2)" :group-name="group.name">
        <template #actions>
          <v-btn color="accent" elevation="0" @click="openCreateModal">
            <lucide-plus :size="18" class="mr-2" />
            {{ $t('global.add') }}
          </v-btn>
        </template>
      </bs-group-settings-page-header>
      <bs-group-templates-tab ref="templatesTab" />
    </div>

    <bs-modal-create-template
      ref="createModal"
      :loading="modalLoading"
      @submit="createTemplate"
    />
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
