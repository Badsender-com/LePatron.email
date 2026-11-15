<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinTaxonomyValueWrites from '~/helpers/mixins/mixin-taxonomy-value-writes.js';
import BsModalConfirm from '~/components/modal-confirm';
import BsTaxonomyTable from '~/components/group/taxonomy-table.vue';
import BsTaxonomyFormDialog from '~/components/group/taxonomy-form-dialog.vue';
import BsTaxonomyDefaultsDialog from '~/components/group/taxonomy-defaults-dialog.vue';
import BsTaxonomyQuickAdd from '~/components/group/taxonomy-quick-add.vue';
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import { taxonomyErrorFor, nextOrder } from '~/helpers/taxonomy.js';
import { valuesWithoutCode } from '~/helpers/taxonomy-roles.js';
import { STANDARD_DIMENSIONS } from '~/helpers/taxonomy-builder.js';

/**
 * The values of one dimension: the email type's, or one the company declared.
 *
 * Emits `count` with the number of values once they are read, so the section
 * around it knows whether the dimension can be deleted, and `values` with the
 * values themselves, so the workspace's tree and points follow every change.
 */
export default {
  name: 'BsGroupTaxonomyTab',
  components: {
    BsModalConfirm,
    BsTaxonomyTable,
    BsTaxonomyFormDialog,
    BsTaxonomyDefaultsDialog,
    BsTaxonomyQuickAdd,
  },
  mixins: [mixinTaxonomyManage, mixinTaxonomyValueWrites],
  props: {
    dimensionName: { type: String, default: STANDARD_DIMENSIONS.EMAIL_TYPE },
    // The dimension this one hangs under, named in the panel: the
    // availability is set in the crossings matrix.
    parentLabel: { type: String, default: '' },
    role: { type: String, default: null },
    // False for a deactivated dimension: the server takes no new value there.
    writable: { type: Boolean, default: true },
  },
  data() {
    return {
      // Apart from `saving` (mixin-taxonomy-value-writes.js): saving must not
      // put the table behind the modal into its skeleton state.
      loading: false,
      // Distinct from an empty list. Without it a failed fetch leaves `items`
      // empty and the table shows "no email type yet" with a create button: the
      // user is told they have none, and invited to duplicate a list nobody
      // managed to read.
      loadError: false,
      items: [],
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
    nextOrder,

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
        this.$emit('values', this.items);
        this.$emit('missing-codes', valuesWithoutCode(this.items));
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

    // A taken label or identifier goes next to its field (helpers/taxonomy.js),
    // the rest to the snackbar.
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
      :can-create="writable"
      :defaultable="!isEmailType && !parentLabel"
      reorderable
      @retry="fetchItems"
      @create="openCreateForm"
      @restore-defaults="openRestoreDefaults"
      @edit="openEditForm"
      @delete="confirmDelete"
      @reorder="reorder"
      @default="toggleDefault"
    />
    <bs-taxonomy-quick-add
      v-if="canManageTaxonomy && writable && !loadError"
      :dimension-name="dimensionName"
      :is-email-type="isEmailType"
      :next-order="nextOrder(items)"
      @added="fetchItems"
      @error="reportError"
    />

    <bs-taxonomy-form-dialog
      ref="formDialog"
      :loading="saving"
      :is-email-type="isEmailType"
      :parent-label="parentLabel"
      :role="role"
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
