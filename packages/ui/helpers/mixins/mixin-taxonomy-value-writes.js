import * as apiRoutes from '~/helpers/api-routes.js';
import { orderedBy } from '~/helpers/reorder.js';

/**
 * The writes of a dimension's values (ADR-0026): create, edit, delete, and the
 * order after a drop. The component using it has `groupId`, `dimensionName`,
 * `items`, `wording`, `fetchItems`, `reportError` and `showSnackbar`.
 *
 * Moves follow each other: the list shows the new order at once, so a second
 * Alt + arrow starts from the first move, and the orders are sent one after
 * the other, the last one kept while one is under way.
 */
export default {
  data() {
    return {
      saving: false,
      deletingItem: null,
      reordering: false,
      // The order to send once the one under way is answered.
      pendingOrder: null,
    };
  },
  methods: {
    async reorder(itemIds) {
      this.items = orderedBy(this.items, itemIds);
      if (this.reordering) {
        this.pendingOrder = itemIds;
        return;
      }
      this.reordering = true;
      let next = itemIds;
      while (next) {
        this.pendingOrder = null;
        try {
          await this.$axios.$put(apiRoutes.taxonomyItemsOrder(), {
            groupId: this.groupId,
            type: this.dimensionName,
            itemIds: next,
          });
          next = this.pendingOrder;
        } catch (error) {
          this.reportError(error);
          next = null;
        }
      }
      this.pendingOrder = null;
      this.reordering = false;
      // The list is read again either way.
      await this.fetchItems();
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
        // Cleared even on a refusal, so the row is not armed for the next one.
        this.deletingItem = null;
        this.saving = false;
      }
    },
  },
};
