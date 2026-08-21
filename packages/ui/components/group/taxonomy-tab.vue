<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirm from '~/components/modal-confirm';
import BsTaxonomyFormDialog from '~/components/group/taxonomy-form-dialog.vue';
import { Tags, Pencil, Trash2 } from 'lucide-vue';

export default {
  name: 'BsGroupTaxonomyTab',
  components: {
    BsDataTable,
    BsModalConfirm,
    BsTaxonomyFormDialog,
    LucideTags: Tags,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
  },
  data() {
    return {
      loading: false,
      items: [],
      deletingItem: null,
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    tableHeaders() {
      return [
        { text: this.$t('taxonomy.table.label'), value: 'label' },
        {
          text: this.$t('taxonomy.table.description'),
          value: 'description',
          sortable: false,
        },
        {
          text: this.$t('taxonomy.table.canonicalType'),
          value: 'canonicalType',
        },
        { text: this.$t('taxonomy.table.order'), value: 'order' },
        { text: this.$t('taxonomy.table.isActive'), value: 'isActive' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
        },
      ];
    },
    deleteConfirmMessage() {
      if (!this.deletingItem) return '';
      return this.$t('taxonomy.deleteConfirmMessage', {
        label: this.deletingItem.label,
      });
    },
  },
  mounted() {
    this.fetchItems();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    // No activeOnly here: the admin screen must show the deactivated items too,
    // they are exactly what the admin came to manage.
    async fetchItems() {
      try {
        this.loading = true;
        const response = await this.$axios.$get(
          apiRoutes.taxonomyItems(this.groupId)
        );
        this.items = response.items || [];
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
      this.$refs.formDialog.open();
    },

    openEditForm(item) {
      this.$refs.formDialog.open(item);
    },

    async saveItem({ id, payload }) {
      try {
        this.loading = true;
        if (id) {
          await this.$axios.$patch(apiRoutes.taxonomyItemsItem(id), payload);
          this.showSnackbar({
            text: this.$t('taxonomy.snackbars.updated'),
            color: 'success',
          });
        } else {
          await this.$axios.$post(apiRoutes.taxonomyItemsCreate(), {
            ...payload,
            // A super admin edits a company other than their own, so the target
            // is always named rather than inferred.
            groupId: this.groupId,
          });
          this.showSnackbar({
            text: this.$t('taxonomy.snackbars.created'),
            color: 'success',
          });
        }
        this.$refs.formDialog.close();
        await this.fetchItems();
      } catch (error) {
        this.showSnackbar({
          text: this.errorMessageFor(error),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    confirmDelete(item) {
      this.deletingItem = item;
      this.$refs.deleteModal.open();
    },

    async deleteItem() {
      if (!this.deletingItem) return;
      const item = this.deletingItem;
      try {
        this.loading = true;
        await this.$axios.$delete(
          apiRoutes.taxonomyItemsItem(item._id || item.id)
        );
        this.showSnackbar({
          text: this.$t('taxonomy.snackbars.deleted'),
          color: 'success',
        });
        this.deletingItem = null;
        await this.fetchItems();
      } catch (error) {
        this.showSnackbar({
          text: this.errorMessageFor(error),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    // The two refusals a user will actually hit deserve an actionable message
    // rather than the generic one: a duplicate label, and a typology still in use
    // — where the count tells the admin whether to reassign or just deactivate.
    errorMessageFor(error) {
      const data = (error.response && error.response.data) || {};

      if (data.message === 'TAXONOMY_ITEM_LABEL_ALREADY_EXISTS') {
        return this.$t('taxonomy.errors.labelAlreadyExists');
      }

      if (data.message === 'TAXONOMY_ITEM_IN_USE') {
        const count = (data.details && data.details.usageCount) || 0;
        return this.$t('taxonomy.errors.inUse', { count });
      }

      return this.$t('global.errors.errorOccured');
    },
  },
};
</script>

<template>
  <div>
    <bs-data-table
      :headers="tableHeaders"
      :items="items"
      :loading="loading"
      clickable
      @click:row="openEditForm"
    >
      <template #item.description="{ item }">
        <span v-if="item.description" class="taxonomy-tab__description">
          {{ item.description }}
        </span>
        <span v-else class="taxonomy-tab__empty-cell">—</span>
      </template>

      <template #item.canonicalType="{ item }">
        <v-chip v-if="item.canonicalType" small outlined color="accent">
          {{ $t(`taxonomy.canonicalTypes.${item.canonicalType}`) }}
        </v-chip>
        <span v-else class="taxonomy-tab__empty-cell">—</span>
      </template>

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
          <lucide-tags :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4 mb-1">
            {{ $t('taxonomy.empty.title') }}
          </p>
          <p class="text-body-2 grey--text text--darken-1">
            {{ $t('taxonomy.empty.description') }}
          </p>
        </div>
      </template>
    </bs-data-table>

    <bs-taxonomy-form-dialog
      ref="formDialog"
      :loading="loading"
      @save="saveItem"
    />

    <bs-modal-confirm
      ref="deleteModal"
      :title="$t('taxonomy.deleteConfirmTitle')"
      :action-label="$t('global.delete')"
      @confirm="deleteItem"
    >
      <p>{{ deleteConfirmMessage }}</p>
      <p class="taxonomy-tab__delete-hint">
        {{ $t('taxonomy.deleteConfirmHint') }}
      </p>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-tab {
  &__description {
    display: block;
    max-width: 32rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
  }

  &__empty-cell {
    color: rgba(0, 0, 0, 0.38);
  }

  &__delete-hint {
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.875rem;
    margin-bottom: 0;
  }
}
</style>
