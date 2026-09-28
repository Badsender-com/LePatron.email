<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsModalConfirm from '~/components/modal-confirm';
import BsTaxonomyTable from '~/components/group/taxonomy-table.vue';
import BsTaxonomyFormDialog from '~/components/group/taxonomy-form-dialog.vue';
import { taxonomyErrorFor, nextOrder } from '~/helpers/taxonomy.js';

export default {
  name: 'BsGroupTaxonomyTab',
  components: {
    BsModalConfirm,
    BsTaxonomyTable,
    BsTaxonomyFormDialog,
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
      // What the server said restoring the defaults would do. Held between the
      // preview call and the confirmation, so the dialog names the typologies
      // rather than announcing a count the user cannot check.
      defaultsPlan: null,
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    deleteConfirmMessage() {
      if (!this.deletingItem) return '';
      return this.$t('taxonomy.deleteConfirmMessage', {
        label: this.deletingItem.label,
      });
    },
    defaultsToCreate() {
      return (this.defaultsPlan && this.defaultsPlan.toCreate) || [];
    },
    // Types the server will not create because another typology already uses the
    // label. Named in the dialog rather than silently absent from the result: the
    // admin is the only one who can tell whether their "Éditorial" is the same
    // thing under a different definition.
    defaultsSkipped() {
      return (this.defaultsPlan && this.defaultsPlan.skipped) || [];
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
          apiRoutes.taxonomyItems(this.groupId)
        );
        this.items = response.items || [];
      } catch (error) {
        this.loadError = true;
        this.items = [];
        this.reportError(error);
      } finally {
        this.loading = false;
      }
    },

    // Two calls, not one: the dialog announces what the server computed, and the
    // write recomputes it. Sending back a list of items to create would let the
    // client decide what goes into the taxonomy.
    //
    // Ignored while a read or a write is in flight: the page header's button is
    // not bound to this component's state, and a double click would otherwise
    // fire two previews and open the dialog on whichever answers last.
    async openRestoreDefaults() {
      if (this.loading || this.saving) return;
      try {
        this.loading = true;
        this.defaultsPlan = await this.$axios.$get(
          apiRoutes.taxonomyDefaultEmailTypes(this.groupId, {
            lang: this.$i18n.locale,
          })
        );
        this.$refs.defaultsModal.open();
      } catch (error) {
        this.reportError(error);
      } finally {
        this.loading = false;
      }
    },

    async restoreDefaults() {
      try {
        this.saving = true;
        const {
          created,
        } = await this.$axios.$post(
          apiRoutes.taxonomyDefaultEmailTypesRestore(),
          { groupId: this.groupId, lang: this.$i18n.locale }
        );
        const count = (created || []).length;
        this.showSnackbar({
          text: count
            ? this.$tc('taxonomy.defaults.snackbarCreated', count, { count })
            : this.$t('taxonomy.defaults.snackbarNone'),
          color: count ? 'success' : 'info',
        });
        await this.fetchItems();
      } catch (error) {
        this.reportError(error);
      } finally {
        this.defaultsPlan = null;
        this.saving = false;
      }
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
          text: this.$t('taxonomy.snackbars.deleted'),
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

    // A duplicate label belongs next to the field the user must change; the rest
    // goes to the snackbar. The mapping lives in helpers/taxonomy.js so it is
    // testable without vue-test-utils.
    reportError(error) {
      const { key, params, count, field } = taxonomyErrorFor(error);
      const text =
        count === null ? this.$t(key, params) : this.$tc(key, count, params);

      if (field === 'label' && this.$refs.formDialog) {
        this.$refs.formDialog.setLabelError(text);
        return;
      }

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
      @retry="fetchItems"
      @create="openCreateForm"
      @restore-defaults="openRestoreDefaults"
      @edit="openEditForm"
      @delete="confirmDelete"
    />

    <bs-taxonomy-form-dialog
      ref="formDialog"
      :loading="saving"
      @save="saveItem"
    />

    <bs-modal-confirm
      ref="defaultsModal"
      :title="$t('taxonomy.defaults.confirmTitle')"
      :action-label="$t('global.add')"
      action-button-color="accent"
      :display-submit-button="defaultsToCreate.length > 0"
      @confirm="restoreDefaults"
    >
      <p v-if="defaultsToCreate.length === 0">
        {{ $t('taxonomy.defaults.confirmNothing') }}
      </p>
      <template v-else>
        <p>{{ $t('taxonomy.defaults.confirmIntro') }}</p>
        <ul class="taxonomy-tab__defaults-list mb-3">
          <li v-for="item in defaultsToCreate" :key="item.canonicalType">
            {{ item.label }}
          </li>
        </ul>
      </template>
      <p v-if="defaultsSkipped.length" class="taxonomy-tab__delete-hint mb-2">
        {{
          $t('taxonomy.defaults.confirmSkipped', {
            labels: defaultsSkipped.map((item) => item.label).join(', '),
          })
        }}
      </p>
    </bs-modal-confirm>

    <bs-modal-confirm
      ref="deleteModal"
      :title="$t('taxonomy.deleteConfirmTitle')"
      :action-label="$t('global.delete')"
      @confirm="deleteItem"
    >
      <p>{{ deleteConfirmMessage }}</p>
      <p class="taxonomy-tab__delete-hint mb-2">
        {{ $t('taxonomy.deleteConfirmHint') }}
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

  &__defaults-list {
    color: var(--gray-700);
    font-size: 0.875rem;
  }
}
</style>
