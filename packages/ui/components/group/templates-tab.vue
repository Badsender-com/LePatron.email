<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form.vue';
import { FileText, Pencil, Trash2, Check } from 'lucide-vue';

export default {
  name: 'BsGroupTemplatesTab',
  components: {
    BsDataTable,
    BsModalConfirmForm,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
    LucideCheck: Check,
  },
  // FileText is used via $options.components for BsDataTable emptyIcon
  FileText,
  data() {
    return {
      templates: [],
      loading: false,
      selectedTemplate: null,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        {
          text: this.$t('tableHeaders.templates.markup'),
          value: 'hasMarkup',
          align: 'center',
          class: 'table-column-action',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          align: 'center',
          sortable: false,
        },
      ];
    },
    groupId() {
      return this.$route.params.groupId;
    },
  },
  async mounted() {
    await this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async fetchData() {
      try {
        this.loading = true;
        const templatesResponse = await this.$axios.$get(
          apiRoutes.groupsItemTemplates({ groupId: this.groupId })
        );
        this.templates = templatesResponse.items;
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    goToTemplate(template) {
      this.$router.push(`/templates/${template.id}`);
    },

    confirmDelete(template) {
      this.selectedTemplate = template;
      this.$refs.deleteDialog.open({ name: template.name, id: template.id });
    },

    async deleteTemplate(template) {
      try {
        await this.$axios.$delete(apiRoutes.templatesItem({ templateId: template.id }));
        await this.fetchData();
        this.showSnackbar({
          text: this.$t('snackbars.deleted'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
  },
};
</script>

<template>
  <div>
    <bs-modal-confirm-form
      ref="deleteDialog"
      :title="$t('templates.deleteConfirmTitle')"
      :action-label="$t('global.delete')"
      :confirmation-input-label="$t('templates.confirmationField')"
      @confirm="deleteTemplate"
    >
      <p class="black--text">
        {{ $t('templates.deleteWarningMessage', { name: selectedTemplate && selectedTemplate.name }) }}
      </p>
    </bs-modal-confirm-form>

    <bs-data-table
      :headers="tableHeaders"
      :items="templates"
      :loading="loading"
      :empty-icon="$options.FileText"
      :empty-message="$t('templates.noTemplates')"
      clickable
      @click:row="goToTemplate"
    >
      <template #item.name="{ item }">
        <span class="font-weight-medium">{{ item.name }}</span>
      </template>

      <template #item.hasMarkup="{ item }">
        <lucide-check v-if="item.hasMarkup" :size="18" class="accent--text" />
      </template>

      <template #item.actions="{ item }">
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              v-bind="attrs"
              v-on="on"
              @click.stop="goToTemplate(item)"
            >
              <lucide-pencil :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.edit') }}</span>
        </v-tooltip>

        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              class="error--text"
              v-bind="attrs"
              v-on="on"
              @click.stop="confirmDelete(item)"
            >
              <lucide-trash2 :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.delete') }}</span>
        </v-tooltip>
      </template>
    </bs-data-table>
  </div>
</template>
