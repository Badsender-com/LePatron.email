<script>
import { mapMutations } from 'vuex';
import { Plus } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTaxonomyEmailTypeDimension from '~/components/group/taxonomy-email-type-dimension.vue';
import BsTaxonomyDimensionFormDialog from '~/components/group/taxonomy-dimension-form-dialog.vue';
import BsTaxonomyTriggerDimension from '~/components/group/taxonomy-trigger-dimension.vue';
import BsTaxonomyCompanyDimension from '~/components/group/taxonomy-company-dimension.vue';
import BsTaxonomyCaseVariantDialog from '~/components/group/taxonomy-case-variant-dialog.vue';
import BsModalConfirm from '~/components/modal-confirm';
import { taxonomyErrorFor, nextOrder } from '~/helpers/taxonomy.js';
import {
  STANDARD_DIMENSIONS,
  DIMENSIONS_PER_COMPANY,
  sortDimensions,
} from '~/helpers/taxonomy-builder.js';

export default {
  name: 'BsTaxonomyDimensions',
  components: {
    BsTaxonomyEmailTypeDimension,
    BsTaxonomyDimensionFormDialog,
    BsTaxonomyCompanyDimension,
    BsTaxonomyTriggerDimension,
    BsTaxonomyCaseVariantDialog,
    BsModalConfirm,
    LucidePlus: Plus,
  },
  data() {
    return {
      dimensions: [],
      saving: false,
      deletingDimension: null,
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    byName() {
      return Object.fromEntries(
        sortDimensions(this.dimensions).map((dimension) => [
          dimension.name,
          dimension,
        ])
      );
    },
    emailType() {
      return this.byName[STANDARD_DIMENSIONS.EMAIL_TYPE] || null;
    },
    trigger() {
      return this.byName[STANDARD_DIMENSIONS.TRIGGER] || null;
    },
    companyDimensions() {
      return sortDimensions(this.dimensions).filter(
        (dimension) => !dimension.standard
      );
    },
    // Told before the click rather than by a refusal: the standard dimensions
    // count, as the server counts them.
    isFull() {
      return this.dimensions.length >= DIMENSIONS_PER_COMPANY;
    },
    dimensionLimit() {
      return DIMENSIONS_PER_COMPANY;
    },
  },
  watch: {
    // A super admin switching company keeps this component mounted.
    groupId: 'fetchDimensions',
  },
  mounted() {
    this.fetchDimensions();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async fetchDimensions() {
      try {
        const response = await this.$axios.$get(
          apiRoutes.taxonomyDimensions(this.groupId, {
            lang: this.$i18n.locale,
          })
        );
        this.dimensions = response.items || [];
      } catch (error) {
        this.dimensions = [];
        this.showSnackbar({
          text: this.$t('taxonomy.dimensions.loadError'),
          color: 'error',
        });
      }
    },

    // The page header's actions act on the email type's values.
    openCreateForm() {
      this.$refs.emailType.openCreateForm();
    },

    openRestoreDefaults() {
      this.$refs.emailType.openRestoreDefaults();
    },

    openEditForm(dimension) {
      this.$refs.formDialog.open(dimension);
    },

    openDeclareForm() {
      this.$refs.formDialog.open(null);
    },

    async saveDimension({ id, payload }) {
      if (!id) {
        await this.declareDimension(payload);
        return;
      }
      const saved = await this.request(
        () => this.$axios.$patch(apiRoutes.taxonomyDimensionsItem(id), payload),
        'taxonomy.dimensions.updated'
      );
      if (saved) this.$refs.formDialog.close();
    },

    async declareDimension(payload) {
      const saved = await this.request(
        () =>
          this.$axios.$post(apiRoutes.taxonomyDimensionsCreate(), {
            ...payload,
            // After the last one, rather than all at 0 and listed
            // before the standard dimensions.
            order: nextOrder(this.dimensions),
            groupId: this.groupId,
          }),
        'taxonomy.dimensions.created',
        // A name differing from an existing one only by its case: the
        // dialog asks, and declares again if the admin confirms.
        (error) => this.$refs.caseVariantDialog.ask(error, payload)
      );
      if (saved) this.$refs.formDialog.close();
    },

    toggleActive(dimension) {
      return this.request(
        () =>
          this.$axios.$patch(apiRoutes.taxonomyDimensionsItem(dimension.id), {
            isActive: !dimension.isActive,
          }),
        dimension.isActive
          ? 'taxonomy.dimensions.deactivated'
          : 'taxonomy.dimensions.reactivated'
      );
    },

    confirmDelete(dimension) {
      this.deletingDimension = dimension;
      this.$refs.deleteModal.open();
    },

    async deleteDimension() {
      const dimension = this.deletingDimension;
      if (!dimension) return;
      await this.request(
        () =>
          this.$axios.$delete(apiRoutes.taxonomyDimensionsItem(dimension.id)),
        'taxonomy.dimensions.deleted'
      );
      this.deletingDimension = null;
    },

    /**
     * Send a write on a dimension, then read the list again.
     *
     * @param {Function} send
     * @param {string} successKey
     * @param {Function} [handleError] takes the error, and returns true when
     *   it dealt with it
     * @returns {Promise<boolean>} whether it went through
     */
    async request(send, successKey, handleError = () => false) {
      // One request at a time: a second click before the first answers would
      // send the same write twice.
      if (this.saving) return false;
      try {
        this.saving = true;
        await send();
        this.showSnackbar({ text: this.$t(successKey), color: 'success' });
        await this.fetchDimensions();
        return true;
      } catch (error) {
        if (!handleError(error)) this.reportError(error);
        return false;
      } finally {
        this.saving = false;
      }
    },

    // A taken name belongs next to the name field; the rest, the limit
    // included, goes to the snackbar.
    reportError(error) {
      const { key, params, count, field } = taxonomyErrorFor(error);
      const text =
        count === null ? this.$t(key, params) : this.$tc(key, count, params);
      if (field && this.$refs.formDialog.setFieldError(field, text)) return;
      this.showSnackbar({ text, color: 'error' });
    },
  },
};
</script>

<template>
  <div>
    <!-- Shown whatever the dimensions answer: its values were managed here
         before dimensions existed, and a failed read must not take them
         away. -->
    <bs-taxonomy-email-type-dimension
      ref="emailType"
      :dimension="emailType"
      :busy="saving"
      @edit="openEditForm"
    />

    <bs-taxonomy-trigger-dimension
      v-if="trigger"
      :dimension="trigger"
      :busy="saving"
      @edit="openEditForm"
    />

    <bs-taxonomy-company-dimension
      v-for="dimension in companyDimensions"
      :key="dimension.id"
      :dimension="dimension"
      :busy="saving"
      :parent="byName[dimension.parentName] || null"
      @edit="openEditForm"
      @toggle-active="toggleActive"
      @delete="confirmDelete"
    />

    <div class="taxonomy-dimension__declare">
      <v-btn
        color="accent"
        outlined
        :disabled="isFull || saving"
        @click="openDeclareForm"
      >
        <lucide-plus :size="18" class="mr-2" />
        {{ $t('taxonomy.dimensions.declare') }}
      </v-btn>
      <span v-if="isFull" class="taxonomy-dimension__hint">
        {{ $t('taxonomy.dimensions.full', { limit: dimensionLimit }) }}
      </span>
    </div>

    <bs-modal-confirm
      ref="deleteModal"
      :title="$t('taxonomy.dimensions.deleteConfirmTitle')"
      :action-label="$t('global.delete')"
      @confirm="deleteDimension"
    >
      <p v-if="deletingDimension">
        {{
          $t('taxonomy.dimensions.deleteConfirmMessage', {
            label: deletingDimension.label,
          })
        }}
      </p>
    </bs-modal-confirm>

    <bs-taxonomy-case-variant-dialog
      ref="caseVariantDialog"
      @confirm="declareDimension"
    />

    <bs-taxonomy-dimension-form-dialog
      ref="formDialog"
      :loading="saving"
      :dimensions="dimensions"
      @save="saveDimension"
    />
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-dimension {
  &__declare {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  &__hint {
    color: var(--gray-700);
    font-size: 0.875rem;
  }
}
</style>
