<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsModalConfirm from '~/components/modal-confirm';
import BsTaxonomyTable from '~/components/group/taxonomy-table.vue';
import BsTaxonomyFormDialog from '~/components/group/taxonomy-form-dialog.vue';
import BsTaxonomyDefaultsDialog from '~/components/group/taxonomy-defaults-dialog.vue';
import { taxonomyErrorFor, nextOrder } from '~/helpers/taxonomy.js';
import { STANDARD_DIMENSIONS } from '~/helpers/taxonomy-builder.js';

/**
 * The values of one dimension: the email type's, or one the company declared.
 *
 * Emits `count` with the number of values once they are read, so the section
 * around it knows whether the dimension can be deleted.
 */
export default {
  name: 'BsGroupTaxonomyTab',
  components: {
    BsModalConfirm,
    BsTaxonomyTable,
    BsTaxonomyFormDialog,
    BsTaxonomyDefaultsDialog,
  },
  props: {
    dimensionName: { type: String, default: STANDARD_DIMENSIONS.EMAIL_TYPE },
  },
  data() {
    return {
      // Two flags: `saving` must not put the table behind the modal into its
      // skeleton state and make it flash on the way back.
      loading: false,
      saving: false,
      // Distinct from an empty list. Without it a failed fetch leaves `items`
      // empty and the table shows "no email type yet" with a create button: the
      // user is told they have none, and invited to duplicate a list nobody
      // managed to read.
      loadError: false,
      items: [],
      deletingItem: null,
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    isEmailType() {
      return this.dimensionName === STANDARD_DIMENSIONS.EMAIL_TYPE;
    },
    // The email type keeps its own words, "typologie"; every other dimension
    // has values.
    wording() {
      return this.isEmailType ? 'taxonomy' : 'taxonomy.values';
    },
    deleteConfirmMessage() {
      if (!this.deletingItem) return '';
      return this.$t(`${this.wording}.deleteConfirmMessage`, {
        label: this.deletingItem.label,
      });
    },
  },
  watch: {
    // A super admin switching company keeps this component mounted, and would
    // otherwise keep reading the previous company's list.
    groupId: 'fetchItems',
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
        this.loadError = false;
        const response = await this.$axios.$get(
          apiRoutes.taxonomyItems(this.groupId, { type: this.dimensionName })
        );
        this.items = response.items || [];
        this.$emit('count', this.items.length);
      } catch (error) {
        this.loadError = true;
        this.items = [];
        this.reportError(error);
      } finally {
        this.loading = false;
      }
    },

    openRestoreDefaults() {
      if (this.loading || this.saving) return;
      this.$refs.defaultsDialog.open();
    },

    async onDefaultsRestored(count) {
      this.showSnackbar({
        text: count
          ? this.$tc('taxonomy.defaults.snackbarCreated', count, { count })
          : this.$t('taxonomy.defaults.snackbarNone'),
        color: count ? 'success' : 'info',
      });
      await this.fetchItems();
    },

    openCreateForm() {
      this.$refs.formDialog.open(null, nextOrder(this.items));
    },

    openEditForm(item) {
      this.$refs.formDialog.open(item);
    },

    async saveItem({ id, payload }) {
      try {
        this.saving = true;
        if (id) {
          await this.$axios.$patch(apiRoutes.taxonomyItemsItem(id), payload);
          this.showSnackbar({
            text: this.$t(`${this.wording}.snackbars.updated`),
            color: 'success',
          });
        } else {
          await this.$axios.$post(apiRoutes.taxonomyItemsCreate(), {
            ...payload,
            type: this.dimensionName,
            // A super admin edits a company other than their own, so the target
            // is always named rather than inferred.
            groupId: this.groupId,
          });
          this.showSnackbar({
            text: this.$t(`${this.wording}.snackbars.created`),
            color: 'success',
          });
        }
        this.$refs.formDialog.close();
        await this.fetchItems();
      } catch (error) {
        this.reportError(error);
      } finally {
        this.saving = false;
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
        this.saving = true;
        await this.$axios.$delete(apiRoutes.taxonomyItemsItem(item.id));
        this.showSnackbar({
          text: this.$t(`${this.wording}.snackbars.deleted`),
          color: 'success',
        });
        await this.fetchItems();
      } catch (error) {
        this.reportError(error);
      } finally {
        // Cleared whatever happened, so a refused delete does not leave the row
        // armed for the next confirmation.
        this.deletingItem = null;
        this.saving = false;
      }
    },

    // A taken label or identifier belongs next to the field the user must
    // change; the rest goes to the snackbar. The mapping lives in
    // helpers/taxonomy.js so it is testable without vue-test-utils.
    reportError(error) {
      const { key, params, count, field } = taxonomyErrorFor(error);
      const text =
        count === null ? this.$t(key, params) : this.$tc(key, count, params);

      if (field && this.$refs.formDialog?.setFieldError(field, text)) return;

      this.showSnackbar({ text, color: 'error' });
    },
  },
};
</script>

<template>
  <div>
    <bs-taxonomy-table
      :items="items"
      :loading="loading"
      :load-error="loadError"
      :is-email-type="isEmailType"
      @retry="fetchItems"
      @create="openCreateForm"
      @restore-defaults="openRestoreDefaults"
      @edit="openEditForm"
      @delete="confirmDelete"
    />

    <bs-taxonomy-form-dialog
      ref="formDialog"
      :loading="saving"
      :is-email-type="isEmailType"
      @save="saveItem"
    />

    <bs-taxonomy-defaults-dialog
      v-if="isEmailType"
      ref="defaultsDialog"
      @restored="onDefaultsRestored"
      @error="reportError"
    />

    <bs-modal-confirm
      ref="deleteModal"
      :title="$t(`${wording}.deleteConfirmTitle`)"
      :action-label="$t('global.delete')"
      @confirm="deleteItem"
    >
      <p>{{ deleteConfirmMessage }}</p>
      <p class="taxonomy-tab__delete-hint mb-2">
        {{ $t(`${wording}.deleteConfirmHint`) }}
      </p>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-tab {
  &__delete-hint {
    color: var(--gray-700);
    font-size: 0.875rem;
  }
}
</style>
