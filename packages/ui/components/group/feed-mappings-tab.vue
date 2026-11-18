<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsFeedMappingFormDialog from '~/components/group/feed-mapping-form-dialog.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { Rss, Pencil, Trash2 } from 'lucide-vue';

export default {
  name: 'BsGroupFeedMappingsTab',
  components: {
    BsDataTable,
    BsFeedMappingFormDialog,
    LucideRss: Rss,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
  },
  data() {
    return {
      loading: false,
      feedMappings: [],
      integrations: [],
      templates: [],
      showForm: false,
      showDeleteDialog: false,
      editingFeedMapping: null,
      deletingFeedMapping: null,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('feedMappings.template'), value: 'templateName' },
        { text: this.$t('feedMappings.block'), value: 'blockName' },
        { text: this.$t('feedMappings.integration'), value: 'integrationName' },
        { text: this.$t('feedMappings.active'), value: 'isActive' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
        },
      ];
    },
    groupId() {
      return this.$route.params.groupId;
    },
    // Table rows need a readable template/integration name, but a feed
    // mapping only stores their ids — join against the already-fetched
    // integrations/templates lists here rather than asking the backend to populate.
    tableItems() {
      const integrationsById = new Map(
        this.integrations.map((integration) => [integration._id, integration])
      );
      const templatesById = new Map(
        this.templates.map((template) => [template._id, template])
      );
      return this.feedMappings.map((feedMapping) => ({
        ...feedMapping,
        integrationName:
          integrationsById.get(feedMapping._integration)?.name || '-',
        templateName: templatesById.get(feedMapping._template)?.name || '-',
      }));
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async fetchData() {
      try {
        this.loading = true;
        const [
          feedMappingsRes,
          integrationsRes,
          templatesRes,
        ] = await Promise.all([
          this.$axios.$get(apiRoutes.feedMappings(this.groupId)),
          this.$axios.$get(apiRoutes.integrations(this.groupId, 'data_feed')),
          this.$axios.$get(
            apiRoutes.groupsItemTemplates({ groupId: this.groupId })
          ),
        ]);
        this.feedMappings = feedMappingsRes.items || [];
        this.integrations = integrationsRes.items || [];
        this.templates = templatesRes.items || [];
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    openCreateForm() {
      this.editingFeedMapping = null;
      this.showForm = true;
    },

    openEditForm(feedMapping) {
      this.editingFeedMapping = { ...feedMapping };
      this.showForm = true;
    },

    closeForm() {
      this.showForm = false;
      this.editingFeedMapping = null;
    },

    async saveFeedMapping(data) {
      try {
        this.loading = true;
        if (this.editingFeedMapping) {
          await this.$axios.$put(
            apiRoutes.feedMappingsItem(this.editingFeedMapping._id),
            data
          );
          this.showSnackbar({
            text: this.$t('feedMappings.updated'),
            color: 'success',
          });
        } else {
          await this.$axios.$post(apiRoutes.feedMappingsCreate(), data);
          this.showSnackbar({
            text: this.$t('feedMappings.created'),
            color: 'success',
          });
        }
        this.closeForm();
        await this.fetchData();
      } catch (error) {
        const errorResponse = error.response && error.response.data;
        const message =
          (errorResponse && errorResponse.message) ||
          this.$t('global.errors.errorOccured');
        this.showSnackbar({ text: message, color: 'error' });
      } finally {
        this.loading = false;
      }
    },

    confirmDelete(feedMapping) {
      this.deletingFeedMapping = feedMapping;
      this.showDeleteDialog = true;
    },

    async deleteFeedMapping() {
      if (!this.deletingFeedMapping) return;
      try {
        this.loading = true;
        await this.$axios.$delete(
          apiRoutes.feedMappingsItem(this.deletingFeedMapping._id)
        );
        this.showSnackbar({
          text: this.$t('feedMappings.deleted'),
          color: 'success',
        });
        this.showDeleteDialog = false;
        this.deletingFeedMapping = null;
        await this.fetchData();
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div>
    <bs-data-table
      :headers="tableHeaders"
      :items="tableItems"
      :loading="loading"
      clickable
      @click:row="openEditForm"
    >
      <template #item.isActive="{ item }">
        <v-chip
          small
          :color="item.isActive ? 'success' : 'grey'"
          :outlined="!item.isActive"
          :dark="item.isActive"
        >
          {{ item.isActive ? $t('global.enabled') : $t('global.disabled') }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <div class="d-flex align-center justify-end">
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                small
                v-bind="attrs"
                v-on="on"
                @click.stop="openEditForm(item)"
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
                v-bind="attrs"
                v-on="on"
                @click.stop="confirmDelete(item)"
              >
                <lucide-trash2 :size="18" class="error--text" />
              </v-btn>
            </template>
            <span>{{ $t('global.delete') }}</span>
          </v-tooltip>
        </div>
      </template>

      <template #no-data>
        <div class="text-center pa-6">
          <lucide-rss :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4">
            {{ $t('feedMappings.noFeedMappings') }}
          </p>
        </div>
      </template>
    </bs-data-table>

    <v-dialog v-model="showForm" max-width="900" persistent>
      <bs-feed-mapping-form-dialog
        :feed-mapping="editingFeedMapping"
        :integrations="integrations"
        :group-id="groupId"
        :loading="loading"
        @save="saveFeedMapping"
        @cancel="closeForm"
      />
    </v-dialog>

    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title>
          {{ $t('feedMappings.deleteConfirmTitle') }}
        </v-card-title>
        <v-card-text>
          {{ $t('feedMappings.deleteConfirmMessage') }}
        </v-card-text>
        <v-divider />
        <div class="modal-actions">
          <v-btn text color="primary" @click="showDeleteDialog = false">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            elevation="0"
            :loading="loading"
            @click="deleteFeedMapping"
          >
            {{ $t('global.delete') }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
}
</style>
