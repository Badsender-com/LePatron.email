import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { taxonomyErrorFor } from '~/helpers/taxonomy.js';

/**
 * The requests on a dimension itself, from the taxonomy workspace: declare,
 * edit, deactivate or delete it, then read the dimensions again. The component
 * using it has `groupId`, `fetchDimensions`, a `formDialog` and a
 * `deleteModal` ref.
 */
export default {
  data() {
    return {
      saving: false,
      deletingDimension: null,
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    openEditForm(dimension) {
      this.$refs.formDialog.open(dimension);
    },

    openDeclareForm() {
      this.$refs.formDialog.open(null);
    },

    async saveDimension({ id, payload }) {
      const saved = await this.request(
        () =>
          id
            ? this.$axios.$patch(apiRoutes.taxonomyDimensionsItem(id), payload)
            : this.$axios.$post(apiRoutes.taxonomyDimensionsCreate(), {
                ...payload,
                groupId: this.groupId,
              }),
        id ? 'taxonomy.dimensions.updated' : 'taxonomy.dimensions.created'
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
     * @returns {Promise<boolean>} whether it went through
     */
    async request(send, successKey) {
      try {
        this.saving = true;
        await send();
        this.showSnackbar({ text: this.$t(successKey), color: 'success' });
        await this.fetchDimensions();
        return true;
      } catch (error) {
        this.reportError(error);
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
