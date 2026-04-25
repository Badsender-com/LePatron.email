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
          align: 'right',
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
        await this.$axios.$delete(
          apiRoutes.templatesItem({ templateId: template.id })
        );
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
        {{
          $t('templates.deleteWarningMessage', {
            name: selectedTemplate && selectedTemplate.name,
          })
        }}
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

<style lang="scss" scoped>
/* =========================================================================
   BsDataTable Styles — LePatron Design System v1.0
   ========================================================================= */

::v-deep .v-data-table thead th {
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: rgba(0, 0, 0, 0.6) !important;
  padding: 10px 16px !important;
  background: rgba(0, 0, 0, 0.02) !important;
  height: 40px !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
  white-space: nowrap;
  user-select: none;
}

::v-deep .v-data-table tbody tr {
  height: 40px !important;
  cursor: pointer;
  transition: background 0.15s ease-out;
}

::v-deep .v-data-table tbody td {
  padding: 10px 16px !important;
  font-size: 13px !important;
  color: rgba(0, 0, 0, 0.87) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
  height: 40px !important;
  vertical-align: middle;
}

::v-deep .v-data-table tbody tr:last-child td {
  border-bottom: none !important;
}

::v-deep .v-data-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected {
  background: rgba(0, 172, 220, 0.06) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected:hover {
  background: rgba(0, 172, 220, 0.1) !important;
}

::v-deep .v-data-table__empty-wrapper {
  padding: 48px 24px !important;
  text-align: center;
  color: rgba(0, 0, 0, 0.87) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

/* Name column - primary color */
::v-deep .v-data-table tbody td:nth-child(1) {
  font-weight: 500 !important;
  color: var(--v-primary-base) !important;
}

/* Actions column - right aligned */
::v-deep .v-data-table tbody td:last-child {
  text-align: right !important;
  width: 1%;
  white-space: nowrap;
}

::v-deep .v-data-table thead th:last-child {
  text-align: right !important;
  width: 1%;
}
</style>
