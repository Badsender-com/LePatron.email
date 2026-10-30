<script>
import { mapMutations } from 'vuex';
import { Pencil } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupTaxonomyTab from '~/components/group/taxonomy-tab.vue';
import BsTaxonomyDimensionFormDialog from '~/components/group/taxonomy-dimension-form-dialog.vue';
import {
  STANDARD_DIMENSIONS,
  TRIGGER_VALUES,
  sortDimensions,
} from '~/helpers/taxonomy-builder.js';

export default {
  name: 'BsTaxonomyDimensions',
  components: {
    BsGroupTaxonomyTab,
    BsTaxonomyDimensionFormDialog,
    LucidePencil: Pencil,
  },
  data() {
    return {
      dimensions: [],
      saving: false,
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
    // The email type section is shown whatever the dimensions answer: its values
    // were managed here before dimensions existed, and a failed read must not
    // take them away.
    emailType() {
      return this.byName[STANDARD_DIMENSIONS.EMAIL_TYPE] || null;
    },
    trigger() {
      return this.byName[STANDARD_DIMENSIONS.TRIGGER] || null;
    },
    triggerValues() {
      return TRIGGER_VALUES;
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
      this.$refs.emailTypeTab.openCreateForm();
    },

    openRestoreDefaults() {
      this.$refs.emailTypeTab.openRestoreDefaults();
    },

    openEditForm(dimension) {
      this.$refs.formDialog.open(dimension);
    },

    async saveDimension({ id, payload }) {
      try {
        this.saving = true;
        await this.$axios.$patch(apiRoutes.taxonomyDimensionsItem(id), payload);
        this.showSnackbar({
          text: this.$t('taxonomy.dimensions.updated'),
          color: 'success',
        });
        this.$refs.formDialog.close();
        await this.fetchDimensions();
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <div>
    <section class="taxonomy-dimension">
      <header class="taxonomy-dimension__header">
        <h2 class="taxonomy-dimension__title">
          {{
            emailType ? emailType.label : $t('taxonomy.dimensions.emailType')
          }}
        </h2>
        <v-chip x-small outlined color="accent">
          {{ $t('taxonomy.dimensions.standard') }}
        </v-chip>
        <v-spacer />
        <v-btn
          v-if="emailType"
          text
          small
          color="accent"
          @click="openEditForm(emailType)"
        >
          <lucide-pencil :size="16" class="mr-1" />
          {{ $t('global.edit') }}
        </v-btn>
      </header>
      <p
        v-if="emailType && emailType.description"
        class="taxonomy-dimension__description"
      >
        {{ emailType.description }}
      </p>
      <p class="taxonomy-dimension__hint">
        {{ $t('taxonomy.emailTypeHint') }}
      </p>
      <bs-group-taxonomy-tab ref="emailTypeTab" />
    </section>

    <section v-if="trigger" class="taxonomy-dimension">
      <header class="taxonomy-dimension__header">
        <h2 class="taxonomy-dimension__title">
          {{ trigger.label }}
        </h2>
        <v-chip x-small outlined color="accent">
          {{ $t('taxonomy.dimensions.standard') }}
        </v-chip>
        <v-spacer />
        <v-btn text small color="accent" @click="openEditForm(trigger)">
          <lucide-pencil :size="16" class="mr-1" />
          {{ $t('global.edit') }}
        </v-btn>
      </header>
      <p v-if="trigger.description" class="taxonomy-dimension__description">
        {{ trigger.description }}
      </p>
      <!-- The doctrine's two values: shown so the admin knows them, never
           edited. -->
      <p class="taxonomy-dimension__hint">
        {{ $t('taxonomy.dimensions.trigger.readOnly') }}
      </p>
      <dl class="taxonomy-dimension__values">
        <div
          v-for="value in triggerValues"
          :key="value.value"
          class="taxonomy-dimension__value"
        >
          <dt>{{ $t(`${value.key}.label`) }}</dt>
          <dd>{{ $t(`${value.key}.description`) }}</dd>
        </div>
      </dl>
    </section>

    <bs-taxonomy-dimension-form-dialog
      ref="formDialog"
      :loading="saving"
      @save="saveDimension"
    />
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-dimension {
  margin-bottom: 2rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
  }

  &__description,
  &__hint {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  &__values {
    margin: 0;
  }

  &__value {
    padding: 0.75rem 0;
    border-top: 1px solid var(--gray-200);

    dt {
      font-weight: 500;
    }

    dd {
      color: var(--gray-700);
      font-size: 0.875rem;
      margin: 0;
    }
  }
}
</style>
